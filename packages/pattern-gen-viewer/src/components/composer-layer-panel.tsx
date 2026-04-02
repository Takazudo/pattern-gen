import { useState, useCallback, useRef, useMemo } from 'react';
import type { EditorLayer, FrameConfig, ImageLayerData, TextLayerData, FrameParamDef } from '@takazudo/pattern-gen-core';
import { FRAME_GENERATORS, framesByName } from '@takazudo/pattern-gen-generators';
import type { AlignmentType, GridConfig } from './composer.js';
import { ComposerFontPicker } from './composer-font-picker.js';
import { HslaColorSwatch } from './hsla-color-picker.js';

/* ── Props ── */

interface LayerPanelProps {
  layers: (EditorLayer & { id: string })[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onUpdate: (id: string, updates: Partial<EditorLayer>) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddImage: () => void;
  onAddText: () => void;
  onImportJson: () => void;
  onAlignLayers: (selectedIds: string[], alignment: AlignmentType) => void;
  gridConfig: GridConfig;
  onGridConfigChange: (config: GridConfig) => void;
  frameConfig: FrameConfig | null;
  onFrameConfigChange: (config: FrameConfig | null) => void;
  processingLayers: Set<string>;
  onBgRemovalToggle: (id: string, enabled: boolean) => void;
  onBgThresholdChange: (id: string, threshold: number) => void;
}

/* ── Component ── */

export function ComposerLayerPanel({
  layers,
  selectedIds,
  onSelect,
  onUpdate,
  onDelete,
  onReorder,
  onAddImage,
  onAddText,
  onImportJson,
  onAlignLayers,
  gridConfig,
  onGridConfigChange,
  frameConfig,
  onFrameConfigChange,
  processingLayers,
  onBgRemovalToggle,
  onBgThresholdChange,
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

  const activeFrameGenerator = frameConfig
    ? framesByName.get(frameConfig.type) ?? null
    : null;

  return (
    <div className="overlay-panel composer-panel">
      {/* Layers section (actions + list) */}
      <div className="composer-panel-section">
        <div className="composer-props-title">Layers</div>
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
      </div>

      {/* Frame section */}
      <div className="composer-panel-section composer-frame-section">
        <div className="composer-props-title">Frame</div>
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
          />
        )}
      </div>

      {/* Alignment panel (2+ layers selected) */}
      {selectedIds.length >= 2 && (
        <div className="composer-panel-section composer-align-panel">
          <div className="composer-props-title">
            Align ({selectedIds.length} layers)
          </div>
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
        </div>
      )}

      {/* Properties panel */}
      {selected && (
        <div className="composer-panel-section composer-props">
          <div className="composer-props-title">Properties</div>

          {/* Common: name */}
          <label className="composer-prop-label">Name</label>
          <input
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
              <label className="composer-prop-label">X</label>
              <input
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
              <label className="composer-prop-label">Y</label>
              <input
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
              <label className="composer-prop-label">W</label>
              <input
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
              <label className="composer-prop-label">H</label>
              <input
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
          <label className="composer-prop-label">
            Opacity: {Math.round(selected.opacity * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(selected.opacity * 100)}
            onChange={(e) =>
              onUpdate(selected.id, {
                opacity: Number(e.target.value) / 100,
              })
            }
          />

          {/* Image-specific */}
          {selected.type === 'image' && (
            <ImageProps
              layer={selected}
              isProcessing={processingLayers.has(selected.id)}
              onUpdate={(updates) => onUpdate(selected.id, updates)}
              onBgRemovalToggle={(enabled) => onBgRemovalToggle(selected.id, enabled)}
              onBgThresholdChange={(threshold) => onBgThresholdChange(selected.id, threshold)}
            />
          )}

          {/* Text-specific */}
          {selected.type === 'text' && (
            <TextProps
              layer={selected}
              onUpdate={(updates) => onUpdate(selected.id, updates)}
            />
          )}
        </div>
      )}

      {/* Grid panel — always visible */}
      <div className="composer-panel-section composer-grid-panel">
        <div className="composer-props-title">Grid</div>
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
      </div>
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
}: {
  layer: ImageLayerData & { id: string };
  isProcessing: boolean;
  onUpdate: (updates: Partial<ImageLayerData>) => void;
  onBgRemovalToggle: (enabled: boolean) => void;
  onBgThresholdChange: (threshold: number) => void;
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
}: {
  layer: TextLayerData & { id: string };
  onUpdate: (updates: Partial<TextLayerData>) => void;
}) {
  return (
    <div className="composer-props-section">
      {/* Content */}
      <label className="composer-prop-label">Content</label>
      <textarea
        className="composer-prop-textarea"
        value={layer.content}
        rows={3}
        onChange={(e) => onUpdate({ content: e.target.value })}
      />

      {/* Font family */}
      <label className="composer-prop-label">Font</label>
      <ComposerFontPicker
        value={layer.fontFamily}
        onChange={(family) => onUpdate({ fontFamily: family })}
      />

      {/* Font size */}
      <label className="composer-prop-label">
        Size: {layer.fontSize}px
      </label>
      <input
        type="range"
        min={8}
        max={200}
        value={layer.fontSize}
        onChange={(e) =>
          onUpdate({ fontSize: Number(e.target.value) })
        }
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
      <label className="composer-prop-label">Color</label>
      <div className="composer-prop-color-row">
        <input
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
      <label className="composer-prop-label">
        Letter Spacing: {layer.letterSpacing}
      </label>
      <input
        type="range"
        min={-10}
        max={20}
        step={0.5}
        value={layer.letterSpacing}
        onChange={(e) =>
          onUpdate({ letterSpacing: Number(e.target.value) })
        }
      />

      {/* Line height */}
      <label className="composer-prop-label">
        Line Height: {layer.lineHeight.toFixed(1)}
      </label>
      <input
        type="range"
        min={0.8}
        max={3.0}
        step={0.1}
        value={layer.lineHeight}
        onChange={(e) =>
          onUpdate({ lineHeight: Number(e.target.value) })
        }
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
              <label className="composer-prop-label">OX</label>
              <input
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
              <label className="composer-prop-label">OY</label>
              <input
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
              <label className="composer-prop-label">Blur</label>
              <input
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
              <label className="composer-prop-label">Color</label>
              <input
                type="text"
                className="composer-prop-input"
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
              <label className="composer-prop-label">Color</label>
              <input
                type="text"
                className="composer-prop-input"
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
            </div>
            <div className="composer-prop-field">
              <label className="composer-prop-label">Width</label>
              <input
                type="number"
                className="composer-prop-input composer-prop-num"
                value={layer.stroke.width}
                onChange={(e) =>
                  onUpdate({
                    stroke: {
                      ...layer.stroke,
                      width: Number(e.target.value),
                    },
                  })
                }
              />
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
}: {
  paramDefs: FrameParamDef[];
  params: Record<string, number | string>;
  onChange: (key: string, value: number | string) => void;
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
        />
      ))}
    </div>
  );
}

function FrameParamControl({
  def,
  value,
  onChange,
}: {
  def: FrameParamDef;
  value: number | string;
  onChange: (value: number | string) => void;
}) {
  switch (def.type) {
    case 'slider':
      return (
        <div className="composer-frame-param-row">
          <label className="composer-prop-label">
            {def.label}: {Number(value).toFixed(def.step < 1 ? 1 : 0)}
          </label>
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      );
    case 'color':
      return (
        <div className="composer-frame-param-row">
          <label className="composer-prop-label">{def.label}</label>
          <div className="composer-prop-color-row">
            <input
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
          <label className="composer-prop-label">{def.label}</label>
          <select
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
