import { useState, useCallback, useRef, useMemo, useId } from 'react';
import type { EditorLayer, FrameConfig, ImageLayerData, TextLayerData, FrameParamDef, LayerFilters } from '@takazudo/pattern-gen-core';
import { normalizeLayerFilters } from '@takazudo/pattern-gen-core';
import { FRAME_GENERATORS, framesByName } from '@takazudo/pattern-gen-generators';
import type { AlignmentType, GridConfig } from './composer.js';
import { ComposerFontPicker } from './composer-font-picker.js';
import { HslaColorSwatch } from './hsla-color-picker.js';

/* ── Editable slider value (inline in label) ── */

function EditableLabelValue({
  formatted,
  onChange,
}: {
  formatted: string;
  onChange: (v: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const escapedRef = useRef(false);

  const handleFocus = () => {
    escapedRef.current = false;
    setDraft(formatted);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (escapedRef.current) {
      escapedRef.current = false;
      return;
    }
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      escapedRef.current = true;
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      className="range-value-editable composer-label-value-editable"
      value={isEditing ? draft : formatted}
      onFocus={handleFocus}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

/* ── Props ── */

interface LayerPanelProps {
  layers: (EditorLayer & { id: string })[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onUpdate: (id: string, updates: Partial<EditorLayer>) => void;
  onUpdateContinuous: (id: string, updates: Partial<EditorLayer>) => void;
  onCommitContinuous: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddImage: () => void;
  onAddText: () => void;
  onImportJson: () => void;
  onAlignLayers: (selectedIds: string[], alignment: AlignmentType) => void;
  gridConfig: GridConfig;
  onGridConfigChange: (config: GridConfig) => void;
  frameConfig: FrameConfig | null;
  onFrameConfigChange: (config: FrameConfig | null) => void;
  onFrameConfigChangeContinuous: (config: FrameConfig | null) => void;
  onFrameConfigCommitContinuous: () => void;
  processingLayers: Set<string>;
  onBgRemovalToggle: (id: string, enabled: boolean) => void;
  onBgThresholdChange: (id: string, threshold: number) => void;
  onBgThresholdCommit: () => void;
}

/* ── Collapsible section for composer panel ── */

function ComposerCollapsibleSection({
  title,
  defaultOpen = true,
  className,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={`composer-panel-section${className ? ` ${className}` : ''}`}>
      <button
        className="composer-section-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <span className="composer-props-title" style={{ marginBottom: 0 }}>{title}</span>
        <span className="composer-section-chevron">{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>
      {isOpen && (
        <div id={contentId} className="composer-section-content">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Component ── */

export function ComposerLayerPanel({
  layers,
  selectedIds,
  onSelect,
  onUpdate,
  onUpdateContinuous,
  onCommitContinuous,
  onDelete,
  onDuplicate,
  onReorder,
  onAddImage,
  onAddText,
  onImportJson,
  onAlignLayers,
  gridConfig,
  onGridConfigChange,
  frameConfig,
  onFrameConfigChange,
  onFrameConfigChangeContinuous,
  onFrameConfigCommitContinuous,
  processingLayers,
  onBgRemovalToggle,
  onBgThresholdChange,
  onBgThresholdCommit,
}: LayerPanelProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Single selected layer for properties panel
  const selected =
    selectedIds.length === 1
      ? layers.find((l) => l.id === selectedIds[0])
      : null;

  const handleDragStart = useCallback(
    (idx: number) => {
      setDragIdx(idx);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      dragOverIdx.current = idx;
    },
    [],
  );

  const handleDrop = useCallback(() => {
    if (dragIdx !== null && dragOverIdx.current !== null && dragIdx !== dragOverIdx.current) {
      onReorder(dragIdx, dragOverIdx.current);
    }
    setDragIdx(null);
    dragOverIdx.current = null;
  }, [dragIdx, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    dragOverIdx.current = null;
  }, []);

  // Frame handlers
  const handleFrameTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (!value) {
        onFrameConfigChange(null);
        return;
      }
      const generator = framesByName.get(value);
      if (!generator) {
        onFrameConfigChange(null);
        return;
      }
      // Initialize params from defaults
      const params: Record<string, number | string> = {};
      for (const def of generator.paramDefs) {
        params[def.key] = def.defaultValue;
      }
      onFrameConfigChange({ type: value, params });
    },
    [onFrameConfigChange],
  );

  const handleFrameParamChange = useCallback(
    (key: string, value: number | string) => {
      if (!frameConfig) return;
      onFrameConfigChange({
        ...frameConfig,
        params: { ...frameConfig.params, [key]: value },
      });
    },
    [frameConfig, onFrameConfigChange],
  );

  const handleFrameParamChangeContinuous = useCallback(
    (key: string, value: number | string) => {
      if (!frameConfig) return;
      onFrameConfigChangeContinuous({
        ...frameConfig,
        params: { ...frameConfig.params, [key]: value },
      });
    },
    [frameConfig, onFrameConfigChangeContinuous],
  );

  const activeFrameGenerator = frameConfig
    ? framesByName.get(frameConfig.type) ?? null
    : null;

  return (
    <div className="overlay-panel composer-panel">
      {/* Layers section (actions + list) */}
      <ComposerCollapsibleSection title="Layers" defaultOpen={true}>
        <div className="composer-panel-actions">
          <button className="btn composer-panel-btn" onClick={onAddImage}>
            Add Image
          </button>
          <button className="btn composer-panel-btn" onClick={onAddText}>
            Add Text
          </button>
          <button className="btn composer-panel-btn" onClick={onImportJson}>
            Import JSON
          </button>
        </div>
        <div className="composer-layer-list">
          {layers.map((layer, idx) => (
            <div
              key={layer.id}
              className={`composer-layer-item ${selectedIdSet.has(layer.id) ? 'selected' : ''} ${dragIdx === idx ? 'dragging' : ''}`}
              draggable
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) {
                  // Toggle in multi-select
                  onSelect(
                    selectedIdSet.has(layer.id)
                      ? selectedIds.filter((id) => id !== layer.id)
                      : [...selectedIds, layer.id],
                  );
                } else {
                  onSelect([layer.id]);
                }
              }}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              <span className="composer-layer-icon">
                {layer.type === 'text' ? 'T' : '\u{1F5BC}'}
              </span>
              <span className="composer-layer-name">{layer.name}</span>
              <button
                className="composer-layer-duplicate"
                aria-label={`Duplicate ${layer.name}`}
                title="Duplicate layer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(layer.id);
                }}
              >
                ⧉
              </button>
              <button
                className="composer-layer-delete"
                aria-label={`Delete ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(layer.id);
                }}
              >
                &times;
              </button>
            </div>
          ))}
          {layers.length === 0 && (
            <div className="composer-layer-empty">No layers yet</div>
          )}
        </div>
      </ComposerCollapsibleSection>

      {/* Frame section */}
      <ComposerCollapsibleSection title="Frame" defaultOpen={false} className="composer-frame-section">
        <select
          className="composer-frame-select"
          value={frameConfig?.type ?? ''}
          onChange={handleFrameTypeChange}
        >
          <option value="">None</option>
          {FRAME_GENERATORS.map((f) => (
            <option key={f.name} value={f.name}>
              {f.displayName}
            </option>
          ))}
        </select>
        {activeFrameGenerator && frameConfig && (
          <FrameParams
            paramDefs={activeFrameGenerator.paramDefs}
            params={frameConfig.params}
            onChange={handleFrameParamChange}
            onChangeContinuous={handleFrameParamChangeContinuous}
            onCommitContinuous={onFrameConfigCommitContinuous}
          />
        )}
      </ComposerCollapsibleSection>

      {/* Alignment panel (2+ layers selected) */}
      {selectedIds.length >= 2 && (
        <ComposerCollapsibleSection title={`Align (${selectedIds.length} layers)`} defaultOpen={true} className="composer-align-panel">
          <div className="composer-align-grid">
            {([
              { type: 'align-left', label: 'Left', title: 'Align Left' },
              { type: 'align-center-h', label: 'Center H', title: 'Align Center (Horizontal)' },
              { type: 'align-right', label: 'Right', title: 'Align Right' },
              { type: 'align-top', label: 'Top', title: 'Align Top' },
              { type: 'align-middle-v', label: 'Middle V', title: 'Align Middle (Vertical)' },
              { type: 'align-bottom', label: 'Bottom', title: 'Align Bottom' },
            ] as const).map((btn) => (
              <button
                key={btn.type}
                className="btn composer-align-btn"
                onClick={() => onAlignLayers(selectedIds, btn.type)}
                title={btn.title}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </ComposerCollapsibleSection>
      )}

      {/* Properties panel */}
      {selected && (
        <ComposerCollapsibleSection title="Properties" defaultOpen={true} className="composer-props">
          {/* Common: name */}
          <label className="composer-prop-label" htmlFor="composer-prop-name">Name</label>
          <input
            id="composer-prop-name"
            type="text"
            className="composer-prop-input"
            value={selected.name}
            onChange={(e) =>
              onUpdate(selected.id, { name: e.target.value })
            }
          />

          {/* Common: transform */}
          <div className="composer-prop-grid">
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-prop-x">X</label>
              <input
                id="composer-prop-x"
                type="number"
                className="composer-prop-input composer-prop-num"
                value={Math.round(selected.transform.x)}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    transform: {
                      ...selected.transform,
                      x: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-prop-y">Y</label>
              <input
                id="composer-prop-y"
                type="number"
                className="composer-prop-input composer-prop-num"
                value={Math.round(selected.transform.y)}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    transform: {
                      ...selected.transform,
                      y: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-prop-w">W</label>
              <input
                id="composer-prop-w"
                type="number"
                className="composer-prop-input composer-prop-num"
                value={Math.round(selected.transform.width)}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    transform: {
                      ...selected.transform,
                      width: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-prop-h">H</label>
              <input
                id="composer-prop-h"
                type="number"
                className="composer-prop-input composer-prop-num"
                value={Math.round(selected.transform.height)}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    transform: {
                      ...selected.transform,
                      height: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>

          {/* Common: opacity */}
          <label className="composer-prop-label" htmlFor="composer-prop-opacity">
            Opacity: {Math.round(selected.opacity * 100)}%
          </label>
          <input
            id="composer-prop-opacity"
            type="range"
            min={0}
            max={100}
            value={Math.round(selected.opacity * 100)}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                opacity: Number(e.target.value) / 100,
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Image-specific */}
          {selected.type === 'image' && (
            <ImageProps
              layer={selected}
              isProcessing={processingLayers.has(selected.id)}
              onUpdate={(updates) => onUpdate(selected.id, updates)}
              onBgRemovalToggle={(enabled) => onBgRemovalToggle(selected.id, enabled)}
              onBgThresholdChange={(threshold) => onBgThresholdChange(selected.id, threshold)}
              onBgThresholdCommit={onBgThresholdCommit}
            />
          )}

          {/* Text-specific */}
          {selected.type === 'text' && (
            <TextProps
              layer={selected}
              onUpdate={(updates) => onUpdate(selected.id, updates)}
              onUpdateContinuous={(updates) => onUpdateContinuous(selected.id, updates)}
              onCommitContinuous={onCommitContinuous}
            />
          )}
        </ComposerCollapsibleSection>
      )}

      {/* Filters section */}
      {selected && (
        <ComposerCollapsibleSection title="Filters" defaultOpen={false} className="composer-filters">
          {/* Blur */}
          <label className="composer-prop-label">
            Blur: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).blur)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, blur: Math.min(20, Math.max(0, v)) } })}
            />px
          </label>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={normalizeLayerFilters(selected.filters).blur}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, blur: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Brightness */}
          <label className="composer-prop-label">
            Brightness: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).brightness)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, brightness: Math.min(200, Math.max(0, v)) } })}
            />%
          </label>
          <input
            type="range"
            min={0}
            max={200}
            value={normalizeLayerFilters(selected.filters).brightness}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, brightness: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Contrast */}
          <label className="composer-prop-label">
            Contrast: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).contrast)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, contrast: Math.min(200, Math.max(0, v)) } })}
            />%
          </label>
          <input
            type="range"
            min={0}
            max={200}
            value={normalizeLayerFilters(selected.filters).contrast}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, contrast: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Saturate */}
          <label className="composer-prop-label">
            Saturate: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).saturate)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, saturate: Math.min(200, Math.max(0, v)) } })}
            />%
          </label>
          <input
            type="range"
            min={0}
            max={200}
            value={normalizeLayerFilters(selected.filters).saturate}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, saturate: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Hue Rotate */}
          <label className="composer-prop-label">
            Hue: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).hueRotate)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, hueRotate: Math.min(360, Math.max(0, v)) } })}
            />°
          </label>
          <input
            type="range"
            min={0}
            max={360}
            value={normalizeLayerFilters(selected.filters).hueRotate}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, hueRotate: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Grayscale */}
          <label className="composer-prop-label">
            Grayscale: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).grayscale)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, grayscale: Math.min(100, Math.max(0, v)) } })}
            />%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={normalizeLayerFilters(selected.filters).grayscale}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, grayscale: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Sepia */}
          <label className="composer-prop-label">
            Sepia: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).sepia)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, sepia: Math.min(100, Math.max(0, v)) } })}
            />%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={normalizeLayerFilters(selected.filters).sepia}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, sepia: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Invert */}
          <label className="composer-prop-label">
            Invert: <EditableLabelValue
              formatted={String(normalizeLayerFilters(selected.filters).invert)}
              onChange={(v) => onUpdate(selected.id, { filters: { ...selected.filters, invert: Math.min(100, Math.max(0, v)) } })}
            />%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={normalizeLayerFilters(selected.filters).invert}
            onChange={(e) =>
              onUpdateContinuous(selected.id, {
                filters: { ...selected.filters, invert: Number(e.target.value) },
              })
            }
            onPointerUp={onCommitContinuous}
          />

          {/* Reset button */}
          <button
            type="button"
            className="composer-btn composer-btn-small"
            onClick={() => onUpdate(selected.id, { filters: undefined })}
          >
            Reset Filters
          </button>
        </ComposerCollapsibleSection>
      )}

      {/* Grid panel — always visible */}
      <ComposerCollapsibleSection title="Grid" defaultOpen={false} className="composer-grid-panel">
        <div className="composer-prop-grid">
          <div className="composer-prop-field">
            <label className="composer-prop-label" htmlFor="composer-grid-vdivide">V Divide</label>
            <input
              id="composer-grid-vdivide"
              type="number"
              className="composer-prop-input composer-prop-num"
              min={1}
              max={12}
              value={gridConfig.vDivide}
              onChange={(e) =>
                onGridConfigChange({
                  ...gridConfig,
                  vDivide: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                })
              }
            />
          </div>
          <div className="composer-prop-field">
            <label className="composer-prop-label" htmlFor="composer-grid-hdivide">H Divide</label>
            <input
              id="composer-grid-hdivide"
              type="number"
              className="composer-prop-input composer-prop-num"
              min={1}
              max={12}
              value={gridConfig.hDivide}
              onChange={(e) =>
                onGridConfigChange({
                  ...gridConfig,
                  hDivide: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                })
              }
            />
          </div>
        </div>
        <label className="composer-prop-label" htmlFor="composer-grid-linecolor">Line Color</label>
        <div className="composer-prop-color-row">
          <input
            id="composer-grid-linecolor"
            type="text"
            className="composer-prop-input composer-prop-color-text"
            value={gridConfig.lineColor}
            onChange={(e) =>
              onGridConfigChange({ ...gridConfig, lineColor: e.target.value })
            }
          />
          <HslaColorSwatch
            color={/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(gridConfig.lineColor) ? gridConfig.lineColor : '#ff0000'}
            onChange={(hex) =>
              onGridConfigChange({ ...gridConfig, lineColor: hex })
            }
            label="Line Color"
          />
        </div>
        <label className="composer-prop-toggle-row">
          <input
            type="checkbox"
            checked={gridConfig.snap}
            onChange={(e) =>
              onGridConfigChange({
                ...gridConfig,
                snap: e.target.checked,
                // Auto-show grid when snap is enabled
                visible: e.target.checked ? true : gridConfig.visible,
              })
            }
          />
          <span className="composer-prop-label">Snap to Grid</span>
        </label>
        <label className="composer-prop-toggle-row">
          <input
            type="checkbox"
            checked={gridConfig.visible}
            onChange={(e) =>
              onGridConfigChange({ ...gridConfig, visible: e.target.checked })
            }
          />
          <span className="composer-prop-label">Show Grid</span>
        </label>
      </ComposerCollapsibleSection>
    </div>
  );
}

/* ── Image properties ── */

function ImageProps({
  layer,
  isProcessing,
  onUpdate,
  onBgRemovalToggle,
  onBgThresholdChange,
  onBgThresholdCommit,
}: {
  layer: ImageLayerData & { id: string };
  isProcessing: boolean;
  onUpdate: (updates: Partial<ImageLayerData>) => void;
  onBgRemovalToggle: (enabled: boolean) => void;
  onBgThresholdChange: (threshold: number) => void;
  onBgThresholdCommit: () => void;
}) {
  const truncatedSrc =
    layer.src.length > 40
      ? layer.src.slice(0, 37) + '...'
      : layer.src;

  const handleReplace = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onUpdate({ src: reader.result as string, name: file.name });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [onUpdate]);

  const bgEnabled = layer.bgRemoval?.enabled ?? false;
  const bgThreshold = layer.bgRemoval?.threshold ?? 0;

  return (
    <div className="composer-props-section">
      <label className="composer-prop-label">Source</label>
      <div className="composer-prop-src-row">
        <span className="composer-prop-src-text">{truncatedSrc}</span>
        <button className="btn composer-prop-btn-sm" onClick={handleReplace}>
          Replace
        </button>
      </div>

      <label className="composer-prop-label" style={{ marginTop: 8 }}>BG Removal</label>
      {isProcessing ? (
        <div
          style={{ fontSize: 11, color: 'var(--color-fg-muted)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}
          role="status"
          aria-busy="true"
        >
          <span className="processing-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
          Removing background...
        </div>
      ) : (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bgEnabled}
              onChange={(e) => onBgRemovalToggle(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)' }}
            />
            Remove background
          </label>
          {bgEnabled && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="range"
                  min={0}
                  max={255}
                  step={1}
                  value={bgThreshold}
                  onChange={(e) => onBgThresholdChange(parseInt(e.target.value, 10))}
                  onPointerUp={onBgThresholdCommit}
                  style={{ flex: 1, accentColor: 'var(--color-accent)' }}
                />
                <span style={{ fontSize: 11, minWidth: 24, textAlign: 'right', color: 'var(--color-fg-muted)' }}>
                  {bgThreshold}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Text properties ── */

function TextProps({
  layer,
  onUpdate,
  onUpdateContinuous,
  onCommitContinuous,
}: {
  layer: TextLayerData & { id: string };
  onUpdate: (updates: Partial<TextLayerData>) => void;
  onUpdateContinuous: (updates: Partial<TextLayerData>) => void;
  onCommitContinuous: () => void;
}) {
  return (
    <div className="composer-props-section">
      {/* Content */}
      <label className="composer-prop-label" htmlFor="composer-text-content">Content</label>
      <textarea
        id="composer-text-content"
        className="composer-prop-textarea"
        value={layer.content}
        rows={3}
        onChange={(e) => onUpdate({ content: e.target.value })}
      />

      {/* Font family */}
      <label className="composer-prop-label" htmlFor="composer-text-font">Font</label>
      <ComposerFontPicker
        id="composer-text-font"
        value={layer.fontFamily}
        onChange={(family) => onUpdate({ fontFamily: family })}
      />

      {/* Font size */}
      <label className="composer-prop-label" htmlFor="composer-text-size">
        Size: <EditableLabelValue formatted={`${layer.fontSize}`} onChange={(v) => onUpdate({ fontSize: v })} />px
      </label>
      <input
        id="composer-text-size"
        type="range"
        min={8}
        max={200}
        value={layer.fontSize}
        onChange={(e) =>
          onUpdateContinuous({ fontSize: Number(e.target.value) })
        }
        onPointerUp={onCommitContinuous}
      />

      {/* Font weight / style toggles */}
      <div className="composer-prop-toggle-row">
        <button
          className={`btn composer-prop-toggle ${layer.fontWeight === 'bold' ? 'active' : ''}`}
          aria-pressed={layer.fontWeight === 'bold'}
          onClick={() =>
            onUpdate({
              fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold',
            })
          }
        >
          Bold
        </button>
        <button
          className={`btn composer-prop-toggle ${layer.fontStyle === 'italic' ? 'active' : ''}`}
          aria-pressed={layer.fontStyle === 'italic'}
          onClick={() =>
            onUpdate({
              fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic',
            })
          }
        >
          Italic
        </button>
      </div>

      {/* Color */}
      <label className="composer-prop-label" htmlFor="composer-text-color">Color</label>
      <div className="composer-prop-color-row">
        <input
          id="composer-text-color"
          type="text"
          className="composer-prop-input composer-prop-color-text"
          value={layer.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
        />
        <HslaColorSwatch
          color={/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(layer.color) ? layer.color : '#ffffff'}
          onChange={(hex) => onUpdate({ color: hex })}
          label="Text color"
        />
      </div>

      {/* Text align */}
      <label className="composer-prop-label">Align</label>
      <div className="composer-prop-toggle-row">
        {(['left', 'center', 'right'] as const).map((a) => (
          <button
            key={a}
            className={`btn composer-prop-toggle ${layer.textAlign === a ? 'active' : ''}`}
            aria-pressed={layer.textAlign === a}
            onClick={() => onUpdate({ textAlign: a })}
          >
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>

      {/* Vertical text align */}
      <label className="composer-prop-label">V Align</label>
      <div className="composer-prop-toggle-row">
        {(['top', 'middle', 'bottom'] as const).map((a) => (
          <button
            key={a}
            className={`btn composer-prop-toggle ${layer.textVAlign === a ? 'active' : ''}`}
            aria-pressed={layer.textVAlign === a}
            onClick={() => onUpdate({ textVAlign: a })}
          >
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>

      {/* Letter spacing */}
      <label className="composer-prop-label" htmlFor="composer-text-letter-spacing">
        Letter Spacing: <EditableLabelValue formatted={`${layer.letterSpacing}`} onChange={(v) => onUpdate({ letterSpacing: v })} />
      </label>
      <input
        id="composer-text-letter-spacing"
        type="range"
        min={-10}
        max={20}
        step={0.5}
        value={layer.letterSpacing}
        onChange={(e) =>
          onUpdateContinuous({ letterSpacing: Number(e.target.value) })
        }
        onPointerUp={onCommitContinuous}
      />

      {/* Line height */}
      <label className="composer-prop-label" htmlFor="composer-text-line-height">
        Line Height: <EditableLabelValue formatted={layer.lineHeight.toFixed(1)} onChange={(v) => onUpdate({ lineHeight: v })} />
      </label>
      <input
        id="composer-text-line-height"
        type="range"
        min={0.8}
        max={3.0}
        step={0.1}
        value={layer.lineHeight}
        onChange={(e) =>
          onUpdateContinuous({ lineHeight: Number(e.target.value) })
        }
        onPointerUp={onCommitContinuous}
      />

      {/* Shadow */}
      <div className="composer-props-subsection">
        <label className="composer-prop-toggle-row">
          <input
            type="checkbox"
            checked={layer.shadow.enabled}
            onChange={(e) =>
              onUpdate({
                shadow: { ...layer.shadow, enabled: e.target.checked },
              })
            }
          />
          <span className="composer-prop-label">Shadow</span>
        </label>
        {layer.shadow.enabled && (
          <div className="composer-prop-grid">
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-shadow-ox">OX</label>
              <input
                id="composer-shadow-ox"
                type="number"
                className="composer-prop-input composer-prop-num"
                value={layer.shadow.offsetX}
                onChange={(e) =>
                  onUpdate({
                    shadow: {
                      ...layer.shadow,
                      offsetX: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-shadow-oy">OY</label>
              <input
                id="composer-shadow-oy"
                type="number"
                className="composer-prop-input composer-prop-num"
                value={layer.shadow.offsetY}
                onChange={(e) =>
                  onUpdate({
                    shadow: {
                      ...layer.shadow,
                      offsetY: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-shadow-blur">Blur</label>
              <input
                id="composer-shadow-blur"
                type="number"
                className="composer-prop-input composer-prop-num"
                value={layer.shadow.blur}
                onChange={(e) =>
                  onUpdate({
                    shadow: {
                      ...layer.shadow,
                      blur: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-shadow-color">Color</label>
              <div className="composer-prop-color-row">
                <input
                  id="composer-shadow-color"
                  type="text"
                  className="composer-prop-input composer-prop-color-text"
                  value={layer.shadow.color}
                  onChange={(e) =>
                    onUpdate({
                      shadow: {
                        ...layer.shadow,
                        color: e.target.value,
                      },
                    })
                  }
                />
                <HslaColorSwatch
                  color={/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(layer.shadow.color) ? layer.shadow.color : '#000000'}
                  onChange={(hex) => onUpdate({ shadow: { ...layer.shadow, color: hex } })}
                  label="Shadow color"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stroke */}
      <div className="composer-props-subsection">
        <label className="composer-prop-toggle-row">
          <input
            type="checkbox"
            checked={layer.stroke.enabled}
            onChange={(e) =>
              onUpdate({
                stroke: { ...layer.stroke, enabled: e.target.checked },
              })
            }
          />
          <span className="composer-prop-label">Stroke</span>
        </label>
        {layer.stroke.enabled && (
          <div className="composer-prop-grid">
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-stroke-color">Color</label>
              <div className="composer-prop-color-row">
                <input
                  id="composer-stroke-color"
                  type="text"
                  className="composer-prop-input composer-prop-color-text"
                  value={layer.stroke.color}
                  onChange={(e) =>
                    onUpdate({
                      stroke: {
                        ...layer.stroke,
                        color: e.target.value,
                      },
                    })
                  }
                />
                <HslaColorSwatch
                  color={/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(layer.stroke.color) ? layer.stroke.color : '#000000'}
                  onChange={(hex) => onUpdate({ stroke: { ...layer.stroke, color: hex } })}
                  label="Stroke color"
                />
              </div>
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label" htmlFor="composer-stroke-width">Width: {layer.stroke.width}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  id="composer-stroke-width"
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={layer.stroke.width}
                  onChange={(e) =>
                    onUpdateContinuous({
                      stroke: {
                        ...layer.stroke,
                        width: Number(e.target.value),
                      },
                    })
                  }
                  onPointerUp={onCommitContinuous}
                />
                <input
                  type="number"
                  className="composer-prop-input composer-prop-num"
                  min={0}
                  max={20}
                  step={0.5}
                  value={layer.stroke.width}
                  onChange={(e) =>
                    onUpdate({
                      stroke: {
                        ...layer.stroke,
                        width: Number(e.target.value),
                      },
                    })
                  }
                  style={{ width: 56 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Frame parameters ── */

function FrameParams({
  paramDefs,
  params,
  onChange,
  onChangeContinuous,
  onCommitContinuous,
}: {
  paramDefs: FrameParamDef[];
  params: Record<string, number | string>;
  onChange: (key: string, value: number | string) => void;
  onChangeContinuous: (key: string, value: number | string) => void;
  onCommitContinuous: () => void;
}) {
  if (paramDefs.length === 0) return null;

  return (
    <div className="composer-frame-params">
      {paramDefs.map((def) => (
        <FrameParamControl
          key={def.key}
          def={def}
          value={params[def.key] ?? def.defaultValue}
          onChange={(v) => onChange(def.key, v)}
          onChangeContinuous={(v) => onChangeContinuous(def.key, v)}
          onCommitContinuous={onCommitContinuous}
        />
      ))}
    </div>
  );
}

function FrameParamControl({
  def,
  value,
  onChange,
  onChangeContinuous,
  onCommitContinuous,
}: {
  def: FrameParamDef;
  value: number | string;
  onChange: (value: number | string) => void;
  onChangeContinuous: (value: number | string) => void;
  onCommitContinuous: () => void;
}) {
  switch (def.type) {
    case 'slider':
      return (
        <div className="composer-frame-param-row">
          <label className="composer-prop-label" htmlFor={`composer-frame-param-${def.key}`}>
            {def.label}: {Number(value).toFixed(def.step < 1 ? 1 : 0)}
          </label>
          <input
            id={`composer-frame-param-${def.key}`}
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={Number(value)}
            onChange={(e) => onChangeContinuous(Number(e.target.value))}
            onPointerUp={onCommitContinuous}
          />
        </div>
      );
    case 'color':
      return (
        <div className="composer-frame-param-row">
          <label className="composer-prop-label" htmlFor={`composer-frame-param-${def.key}`}>{def.label}</label>
          <div className="composer-prop-color-row">
            <input
              id={`composer-frame-param-${def.key}`}
              type="text"
              className="composer-prop-input composer-prop-color-text"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
            />
            <HslaColorSwatch
              color={/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(String(value)) ? String(value) : '#000000'}
              onChange={(hex) => onChange(hex)}
              label={def.label}
            />
          </div>
        </div>
      );
    case 'select':
      return (
        <div className="composer-frame-param-row">
          <label className="composer-prop-label" htmlFor={`composer-frame-param-${def.key}`}>{def.label}</label>
          <select
            id={`composer-frame-param-${def.key}`}
            className="composer-frame-select"
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          >
            {def.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'toggle':
      return (
        <div className="composer-frame-param-row">
          <label className="composer-prop-toggle-row">
            <input
              type="checkbox"
              checked={Number(value) === 1}
              onChange={(e) => onChange(e.target.checked ? 1 : 0)}
            />
            <span className="composer-prop-label">{def.label}</span>
          </label>
        </div>
      );
    default:
      return null;
  }
}
