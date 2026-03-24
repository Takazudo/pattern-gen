import { centerDetentToZoom } from 'pattern-gen/core/center-detent';

interface ViewTransformPanelProps {
  zoomSlider: number; // 0-100 slider value
  translateX: number; // -100 to 100
  translateY: number; // -100 to 100
  onChange: (zoomSlider: number, translateX: number, translateY: number) => void;
}

/** Snap to center if within ±2 of 50 */
function snapCenter(value: number): number {
  return Math.abs(value - 50) <= 2 ? 50 : value;
}

export function ViewTransformPanel({
  zoomSlider,
  translateX,
  translateY,
  onChange,
}: ViewTransformPanelProps) {
  const handleReset = () => onChange(50, 0, 0);

  const handleZoomChange = (raw: number) => {
    onChange(snapCenter(raw), translateX, translateY);
  };

  const zoomDisplay = centerDetentToZoom(zoomSlider).toFixed(1);

  return (
    <div className="view-transform-section">
      <label className="section-label">View Transform</label>

      <div className="view-transform-slider-row view-transform-zoom-row">
        <span className="view-transform-label">Z</span>
        <div className="view-transform-zoom-track">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={zoomSlider}
            onChange={(e) => handleZoomChange(parseInt(e.target.value))}
            aria-label="Zoom"
          />
          <span className="view-transform-zoom-tick" aria-hidden="true" />
        </div>
        <span className="view-transform-value">{zoomDisplay}x</span>
      </div>

      <div className="view-transform-slider-row">
        <span className="view-transform-label">X</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={translateX}
          onChange={(e) => onChange(zoomSlider, parseInt(e.target.value), translateY)}
          aria-label="Translate X"
        />
        <span className="view-transform-value">{translateX}</span>
      </div>

      <div className="view-transform-slider-row">
        <span className="view-transform-label">Y</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={translateY}
          onChange={(e) => onChange(zoomSlider, translateX, parseInt(e.target.value))}
          aria-label="Translate Y"
        />
        <span className="view-transform-value">{translateY}</span>
      </div>

      <button className="btn btn-view-transform-reset" onClick={handleReset}>
        Reset
      </button>
    </div>
  );
}
