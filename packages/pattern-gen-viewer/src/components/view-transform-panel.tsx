import { centerDetentToZoom } from '@takazudo/pattern-gen-core';
import * as Popover from '@radix-ui/react-popover';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

interface ViewTransformPanelProps {
  zoomSlider: number; // 0-100 slider value
  translateX: number; // -100 to 100
  translateY: number; // -100 to 100
  useTranslate: boolean;
  rotate: number; // -180 to 180 degrees
  skewX: number; // -45 to 45 degrees
  skewY: number; // -45 to 45 degrees
  fixedViewTransform: boolean;
  onChange: (zoomSlider: number, translateX: number, translateY: number) => void;
  onUseTranslateChange: (enabled: boolean) => void;
  onRotateChange: (degrees: number) => void;
  onSkewChange: (skewX: number, skewY: number) => void;
  onFixedViewTransformChange: (fixed: boolean) => void;
}

/** Snap to center if within ±2 of 50 */
function snapCenter(value: number): number {
  return Math.abs(value - 50) <= 2 ? 50 : value;
}

export function ViewTransformPanel({
  zoomSlider,
  translateX,
  translateY,
  useTranslate,
  rotate,
  skewX,
  skewY,
  fixedViewTransform,
  onChange,
  onUseTranslateChange,
  onRotateChange,
  onSkewChange,
  onFixedViewTransformChange,
}: ViewTransformPanelProps) {
  const handleReset = () => {
    onChange(50, 0, 0);
    onUseTranslateChange(false);
    onRotateChange(0);
    onSkewChange(0, 0);
  };

  const handleZoomChange = (raw: number) => {
    onChange(snapCenter(raw), translateX, translateY);
  };

  const zoomDisplay = centerDetentToZoom(zoomSlider).toFixed(1);

  return (
    <div className="view-transform-section">
      <div className="param-label-row">
        <label className="section-label">View Transform</label>
        <label className="fix-toggle">
          <input
            type="checkbox"
            checked={fixedViewTransform}
            onChange={(e) => onFixedViewTransformChange(e.target.checked)}
          />
          Fix
        </label>
      </div>

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

      {!isIOS && (
        <div className="view-transform-checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={useTranslate}
              onChange={(e) => onUseTranslateChange(e.target.checked)}
            />
            <span>Use big canvas</span>
          </label>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="info-trigger" type="button" aria-label="What is big canvas?">
                &#9432;
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className="info-popover" side="top" sideOffset={5}>
                Renders patterns on a larger canvas for smooth panning and rotation. Uses more memory and may be slower on some devices.
                <Popover.Arrow className="info-popover-arrow" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      )}

      <div className="view-transform-slider-row">
        <span className="view-transform-label">X</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={translateX}
          disabled={!useTranslate}
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
          disabled={!useTranslate}
          onChange={(e) => onChange(zoomSlider, translateX, parseInt(e.target.value))}
          aria-label="Translate Y"
        />
        <span className="view-transform-value">{translateY}</span>
      </div>

      <div className="view-transform-slider-row">
        <span className="view-transform-label">R</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotate}
          disabled={!useTranslate}
          onChange={(e) => onRotateChange(parseInt(e.target.value))}
          aria-label="Rotate"
        />
        <span className="view-transform-value">{rotate}°</span>
      </div>

      <div className="view-transform-slider-row">
        <span className="view-transform-label">Sk X</span>
        <input
          type="range"
          min={-45}
          max={45}
          step={1}
          value={skewX}
          disabled={!useTranslate}
          onChange={(e) => onSkewChange(parseInt(e.target.value), skewY)}
          aria-label="Skew X"
        />
        <span className="view-transform-value">{skewX}°</span>
      </div>

      <div className="view-transform-slider-row">
        <span className="view-transform-label">Sk Y</span>
        <input
          type="range"
          min={-45}
          max={45}
          step={1}
          value={skewY}
          disabled={!useTranslate}
          onChange={(e) => onSkewChange(skewX, parseInt(e.target.value))}
          aria-label="Skew Y"
        />
        <span className="view-transform-value">{skewY}°</span>
      </div>

      <button className="btn btn-view-transform-reset" onClick={handleReset}>
        Reset
      </button>
    </div>
  );
}
