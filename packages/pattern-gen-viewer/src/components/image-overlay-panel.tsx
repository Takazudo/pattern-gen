import { useState, useCallback, useRef } from 'react';

interface ImageOverlayPanelProps {
  hasImage: boolean;
  isProcessing: boolean;
  processingProgress: number;
  bgThreshold: number;
  overlayOpacity: number;
  keepAspectRatio: boolean;
  error: string | null;
  onImport: (file: File) => void;
  onClear: () => void;
  onThresholdChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
  onKeepAspectRatioChange: (keep: boolean) => void;
}

export function ImageOverlayPanel({
  hasImage,
  isProcessing,
  processingProgress,
  bgThreshold,
  overlayOpacity,
  keepAspectRatio,
  error,
  onImport,
  onClear,
  onThresholdChange,
  onOpacityChange,
  onKeepAspectRatioChange,
}: ImageOverlayPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImport(file);
      // Reset input so re-importing the same file works
      e.target.value = '';
    },
    [onImport],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
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

  return (
    <div className="image-overlay-section">
      <label className="section-label">Image Overlay</label>

      {isProcessing ? (
        <div className="processing-indicator" role="status" aria-busy="true">
          <div className="processing-spinner" aria-hidden="true" />
          <span>Removing background... {processingProgress}%</span>
          <div
            className="processing-progress-bar"
            role="progressbar"
            aria-label="Background removal progress"
            aria-valuenow={processingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="processing-progress-fill"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      ) : hasImage ? (
        <>
          <button className="btn image-overlay-clear-btn" onClick={onClear}>
            Clear
          </button>

          <div className="image-overlay-aspect-row">
            <span className="image-overlay-label">Aspect Ratio</span>
            <div className="image-overlay-aspect-btns">
              <button
                className={`btn image-overlay-aspect-btn${keepAspectRatio ? ' active' : ''}`}
                onClick={() => onKeepAspectRatioChange(true)}
              >
                Original
              </button>
              <button
                className={`btn image-overlay-aspect-btn${!keepAspectRatio ? ' active' : ''}`}
                onClick={() => onKeepAspectRatioChange(false)}
              >
                Free
              </button>
            </div>
          </div>

          <div className="image-overlay-controls">
            <div className="image-overlay-slider-row">
              <span className="image-overlay-label">BG Threshold</span>
              <div className="range-row">
                <input
                  type="range"
                  min={0}
                  max={255}
                  step={1}
                  value={bgThreshold}
                  onChange={(e) => onThresholdChange(parseInt(e.target.value, 10))}
                  aria-label="Background removal threshold"
                />
                <span className="range-value">{bgThreshold}</span>
              </div>
              <button
                className="btn image-overlay-reset-btn"
                onClick={() => onThresholdChange(0)}
              >
                Reset
              </button>
            </div>

            <div className="image-overlay-slider-row">
              <span className="image-overlay-label">Overlay Opacity</span>
              <div className="range-row">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={overlayOpacity}
                  onChange={(e) => onOpacityChange(parseInt(e.target.value, 10))}
                  aria-label="Overlay opacity"
                />
                <span className="range-value">{overlayOpacity}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className={`image-import-area${isDragging ? ' dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              hidden
            />
            <span>Import Image</span>
            <span className="image-import-hint">or drag &amp; drop</span>
          </div>
          {error && (
            <div className="image-overlay-error">{error}</div>
          )}
        </>
      )}
    </div>
  );
}
