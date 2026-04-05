import { useState, useCallback, useRef, useMemo, memo } from 'react';
import type { ViewerImageLayer } from '../types/viewer-image-layer.js';

interface ImageLayerPanelProps {
  layers: ViewerImageLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onImport: (file: File) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onOpacityChange: (id: string, value: number) => void;
  onThresholdChange: (id: string, value: number) => void;
  onBgRemovalToggle: (id: string, enabled: boolean) => void;
  onKeepAspectRatioChange: (id: string, keep: boolean) => void;
  onBrowseFiles?: (layerId: string) => void;
}

export function ImageLayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onImport,
  onDeleteLayer,
  onDuplicateLayer,
  onReorder,
  onOpacityChange,
  onThresholdChange,
  onBgRemovalToggle,
  onKeepAspectRatioChange,
  onBrowseFiles,
}: ImageLayerPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImport(file);
      e.target.value = '';
    },
    [onImport],
  );

  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDropZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onImport(file);
      }
    },
    [onImport],
  );

  // Layer drag-to-reorder handlers
  const handleLayerDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleLayerDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  }, []);

  const handleLayerDrop = useCallback(() => {
    if (dragIdx !== null && dragOverIdx.current !== null && dragIdx !== dragOverIdx.current) {
      onReorder(dragIdx, dragOverIdx.current);
    }
    setDragIdx(null);
    dragOverIdx.current = null;
  }, [dragIdx, onReorder]);

  const handleLayerDragEnd = useCallback(() => {
    setDragIdx(null);
    dragOverIdx.current = null;
  }, []);

  return (
    <div className="image-layer-panel">
      <label className="section-label">Image Layers</label>

      {/* Add image drop zone */}
      <div
        className={`image-import-area image-layer-add${isDragging ? ' dragging' : ''}`}
        onDragOver={handleDropZoneDragOver}
        onDragLeave={handleDropZoneDragLeave}
        onDrop={handleDropZoneDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          hidden
        />
        <span>Add Image</span>
        <span className="image-import-hint">or drag &amp; drop</span>
      </div>

      {/* Layer list */}
      {layers.length > 0 && (
        <div className="image-layer-list">
          {layers.map((layer, idx) => (
            <div
              key={layer.id}
              className={`image-layer-item${layer.id === selectedLayerId ? ' selected' : ''}${dragIdx === idx ? ' dragging' : ''}`}
              draggable
              onClick={() => onSelectLayer(layer.id === selectedLayerId ? null : layer.id)}
              onDragStart={() => handleLayerDragStart(idx)}
              onDragOver={(e) => handleLayerDragOver(e, idx)}
              onDrop={handleLayerDrop}
              onDragEnd={handleLayerDragEnd}
            >
              <span className="image-layer-drag-handle" aria-hidden="true">::</span>
              <LayerThumbnail layer={layer} />
              <span className="image-layer-name">{layer.name}</span>
              {layer.isProcessing && (
                <span className="processing-spinner image-layer-spinner" aria-label="Processing" />
              )}
              <button
                className={`image-layer-bg-toggle${layer.bgRemovalEnabled ? ' active' : ''}${!layer.hasBgRemovalData ? ' no-data' : ''}`}
                title={
                  !layer.hasBgRemovalData
                    ? 'Remove background'
                    : layer.bgRemovalEnabled
                      ? 'BG removal on'
                      : 'BG removal off'
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (!layer.hasBgRemovalData) {
                    onBgRemovalToggle(layer.id, true);
                  } else {
                    onBgRemovalToggle(layer.id, !layer.bgRemovalEnabled);
                  }
                }}
                disabled={layer.isProcessing}
              >
                {!layer.hasBgRemovalData ? 'BG\u00A0Rm' : 'BG'}
              </button>
              {onBrowseFiles && (
                <button
                  className="image-layer-browse"
                  aria-label={`Browse assets for ${layer.name}`}
                  title="Browse My Assets"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBrowseFiles(layer.id);
                  }}
                >
                  ⬒
                </button>
              )}
              <button
                className="image-layer-duplicate"
                aria-label={`Duplicate ${layer.name}`}
                title="Duplicate layer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateLayer(layer.id);
                }}
              >
                ⧉
              </button>
              <button
                className="image-layer-delete"
                aria-label={`Delete ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLayer(layer.id);
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error display for selected layer (shown even if processed is null) */}
      {selectedLayer && !selectedLayer.isProcessing && selectedLayer.error && (
        <div className="image-overlay-error">{selectedLayer.error}</div>
      )}

      {/* Selected layer controls */}
      {selectedLayer && !selectedLayer.isProcessing && selectedLayer.processed && (
        <div className="image-layer-controls">
          <div className="image-overlay-slider-row">
            <span className="image-overlay-label">Opacity</span>
            <div className="range-row">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={selectedLayer.opacity}
                onChange={(e) => onOpacityChange(selectedLayer.id, parseInt(e.target.value, 10))}
                aria-label="Overlay opacity"
              />
              <span className="range-value">{selectedLayer.opacity}</span>
            </div>
          </div>

          {selectedLayer.bgRemovalEnabled && (
            <div className="image-overlay-slider-row">
              <span className="image-overlay-label">BG Threshold</span>
              <div className="range-row">
                <input
                  type="range"
                  min={0}
                  max={255}
                  step={1}
                  value={selectedLayer.bgThreshold}
                  onChange={(e) => onThresholdChange(selectedLayer.id, parseInt(e.target.value, 10))}
                  aria-label="Background removal threshold"
                />
                <span className="range-value">{selectedLayer.bgThreshold}</span>
              </div>
              <button
                className="btn image-overlay-reset-btn"
                onClick={() => onThresholdChange(selectedLayer.id, 0)}
              >
                Reset
              </button>
            </div>
          )}

          <div className="image-overlay-aspect-row">
            <span className="image-overlay-label">Aspect Ratio</span>
            <div className="image-overlay-aspect-btns">
              <button
                className={`btn image-overlay-aspect-btn${selectedLayer.keepAspectRatio ? ' active' : ''}`}
                onClick={() => onKeepAspectRatioChange(selectedLayer.id, true)}
              >
                Original
              </button>
              <button
                className={`btn image-overlay-aspect-btn${!selectedLayer.keepAspectRatio ? ' active' : ''}`}
                onClick={() => onKeepAspectRatioChange(selectedLayer.id, false)}
              >
                Free
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing indicator for selected layer */}
      {selectedLayer && selectedLayer.isProcessing && (
        <div className="processing-indicator" role="status" aria-busy="true">
          <div className="processing-spinner" aria-hidden="true" />
          <span>Removing background... {selectedLayer.processingProgress}%</span>
          <div
            className="processing-progress-bar"
            role="progressbar"
            aria-label="Background removal progress"
            aria-valuenow={selectedLayer.processingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="processing-progress-fill"
              style={{ width: `${selectedLayer.processingProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const LayerThumbnail = memo(function LayerThumbnail({ layer }: { layer: ViewerImageLayer }) {
  const dataUrl = useMemo(() => {
    if (!layer.processed) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const tempCanvas = new OffscreenCanvas(layer.processed.width, layer.processed.height);
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;
    tempCtx.putImageData(layer.processed.original, 0, 0);

    const aspect = layer.processed.width / layer.processed.height;
    let dw: number;
    let dh: number;
    if (aspect > 1) {
      dw = 40;
      dh = 40 / aspect;
    } else {
      dh = 40;
      dw = 40 * aspect;
    }
    ctx.drawImage(tempCanvas, (40 - dw) / 2, (40 - dh) / 2, dw, dh);
    return canvas.toDataURL('image/png');
  }, [layer.processed]);

  if (!dataUrl) {
    return <span className="image-layer-thumbnail image-layer-thumbnail-empty" />;
  }

  return (
    <img
      className="image-layer-thumbnail"
      src={dataUrl}
      alt={layer.name}
      width={40}
      height={40}
    />
  );
});
