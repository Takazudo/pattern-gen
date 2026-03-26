import { useState, useCallback, useRef } from 'react';
import type { EditorLayer, ImageLayerData, TextLayerData } from 'pattern-gen/core/ogp-editor-config';
import type { GridConfig } from './ogp-editor.js';
import { OgpEditorFontPicker } from './ogp-editor-font-picker.js';

/* ── Props ── */

interface LayerPanelProps {
  layers: (EditorLayer & { id: string })[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<EditorLayer>) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddImage: () => void;
  onAddText: () => void;
  onImportJson: () => void;
  gridConfig: GridConfig;
  onGridConfigChange: (config: GridConfig) => void;
}

/* ── Component ── */

export function OgpEditorLayerPanel({
  layers,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onReorder,
  onAddImage,
  onAddText,
  onImportJson,
  gridConfig,
  onGridConfigChange,
}: LayerPanelProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const selected = selectedId
    ? layers.find((l) => l.id === selectedId)
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

  return (
    <div className="ogp-editor-panel">
      {/* Action buttons */}
      <div className="ogp-panel-actions">
        <button className="btn ogp-panel-btn" onClick={onAddImage}>
          Add Image
        </button>
        <button className="btn ogp-panel-btn" onClick={onAddText}>
          Add Text
        </button>
        <button className="btn ogp-panel-btn" onClick={onImportJson}>
          Import JSON
        </button>
      </div>

      {/* Layer list */}
      <div className="ogp-layer-list">
        {layers.map((layer, idx) => (
          <div
            key={layer.id}
            className={`ogp-layer-item ${layer.id === selectedId ? 'selected' : ''} ${dragIdx === idx ? 'dragging' : ''}`}
            draggable
            onClick={() => onSelect(layer.id)}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <span className="ogp-layer-icon">
              {layer.type === 'text' ? 'T' : '\u{1F5BC}'}
            </span>
            <span className="ogp-layer-name">{layer.name}</span>
            <button
              className="ogp-layer-delete"
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
          <div className="ogp-layer-empty">No layers yet</div>
        )}
      </div>

      {/* Properties panel */}
      {selected && (
        <div className="ogp-props">
          <div className="ogp-props-title">Properties</div>

          {/* Common: name */}
          <label className="ogp-prop-label">Name</label>
          <input
            type="text"
            className="ogp-prop-input"
            value={selected.name}
            onChange={(e) =>
              onUpdate(selected.id, { name: e.target.value })
            }
          />

          {/* Common: transform */}
          <div className="ogp-prop-grid">
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">X</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">Y</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">W</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">H</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
          <label className="ogp-prop-label">
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
              onUpdate={(updates) => onUpdate(selected.id, updates)}
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
      <div className="ogp-grid-panel">
        <div className="ogp-grid-panel-title">Grid</div>
        <div className="ogp-prop-grid">
          <div className="ogp-prop-field">
            <label className="ogp-prop-label">V Divide</label>
            <input
              type="number"
              className="ogp-prop-input ogp-prop-num"
              min={1}
              max={12}
              value={gridConfig.vDivide}
              onChange={(e) =>
                onGridConfigChange({
                  ...gridConfig,
                  vDivide: Math.max(1, Math.min(12, Number(e.target.value))),
                })
              }
            />
          </div>
          <div className="ogp-prop-field">
            <label className="ogp-prop-label">H Divide</label>
            <input
              type="number"
              className="ogp-prop-input ogp-prop-num"
              min={1}
              max={12}
              value={gridConfig.hDivide}
              onChange={(e) =>
                onGridConfigChange({
                  ...gridConfig,
                  hDivide: Math.max(1, Math.min(12, Number(e.target.value))),
                })
              }
            />
          </div>
        </div>
        <label className="ogp-prop-toggle-row">
          <input
            type="checkbox"
            checked={gridConfig.snap}
            onChange={(e) =>
              onGridConfigChange({ ...gridConfig, snap: e.target.checked })
            }
          />
          <span className="ogp-prop-label">Snap to Grid</span>
        </label>
        <label className="ogp-prop-toggle-row">
          <input
            type="checkbox"
            checked={gridConfig.visible}
            onChange={(e) =>
              onGridConfigChange({ ...gridConfig, visible: e.target.checked })
            }
          />
          <span className="ogp-prop-label">Show Grid</span>
        </label>
      </div>
    </div>
  );
}

/* ── Image properties ── */

function ImageProps({
  layer,
  onUpdate,
}: {
  layer: ImageLayerData & { id: string };
  onUpdate: (updates: Partial<ImageLayerData>) => void;
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

  return (
    <div className="ogp-props-section">
      <label className="ogp-prop-label">Source</label>
      <div className="ogp-prop-src-row">
        <span className="ogp-prop-src-text">{truncatedSrc}</span>
        <button className="btn ogp-prop-btn-sm" onClick={handleReplace}>
          Replace
        </button>
      </div>
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
    <div className="ogp-props-section">
      {/* Content */}
      <label className="ogp-prop-label">Content</label>
      <textarea
        className="ogp-prop-textarea"
        value={layer.content}
        rows={3}
        onChange={(e) => onUpdate({ content: e.target.value })}
      />

      {/* Font family */}
      <label className="ogp-prop-label">Font</label>
      <OgpEditorFontPicker
        value={layer.fontFamily}
        onChange={(family) => onUpdate({ fontFamily: family })}
      />

      {/* Font size */}
      <label className="ogp-prop-label">
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
      <div className="ogp-prop-toggle-row">
        <button
          className={`btn ogp-prop-toggle ${layer.fontWeight === 'bold' ? 'active' : ''}`}
          onClick={() =>
            onUpdate({
              fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold',
            })
          }
        >
          Bold
        </button>
        <button
          className={`btn ogp-prop-toggle ${layer.fontStyle === 'italic' ? 'active' : ''}`}
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
      <label className="ogp-prop-label">Color</label>
      <div className="ogp-prop-color-row">
        <input
          type="text"
          className="ogp-prop-input ogp-prop-color-text"
          value={layer.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
        />
        <input
          type="color"
          className="ogp-prop-color-picker"
          value={layer.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
        />
      </div>

      {/* Text align */}
      <label className="ogp-prop-label">Align</label>
      <div className="ogp-prop-toggle-row">
        {(['left', 'center', 'right'] as const).map((a) => (
          <button
            key={a}
            className={`btn ogp-prop-toggle ${layer.textAlign === a ? 'active' : ''}`}
            onClick={() => onUpdate({ textAlign: a })}
          >
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>

      {/* Letter spacing */}
      <label className="ogp-prop-label">
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
      <label className="ogp-prop-label">
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
      <div className="ogp-props-subsection">
        <label className="ogp-prop-toggle-row">
          <input
            type="checkbox"
            checked={layer.shadow.enabled}
            onChange={(e) =>
              onUpdate({
                shadow: { ...layer.shadow, enabled: e.target.checked },
              })
            }
          />
          <span className="ogp-prop-label">Shadow</span>
        </label>
        {layer.shadow.enabled && (
          <div className="ogp-prop-grid">
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">OX</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">OY</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">Blur</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">Color</label>
              <input
                type="text"
                className="ogp-prop-input"
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
      <div className="ogp-props-subsection">
        <label className="ogp-prop-toggle-row">
          <input
            type="checkbox"
            checked={layer.stroke.enabled}
            onChange={(e) =>
              onUpdate({
                stroke: { ...layer.stroke, enabled: e.target.checked },
              })
            }
          />
          <span className="ogp-prop-label">Stroke</span>
        </label>
        {layer.stroke.enabled && (
          <div className="ogp-prop-grid">
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">Color</label>
              <input
                type="text"
                className="ogp-prop-input"
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
            <div className="ogp-prop-field">
              <label className="ogp-prop-label">Width</label>
              <input
                type="number"
                className="ogp-prop-input ogp-prop-num"
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
