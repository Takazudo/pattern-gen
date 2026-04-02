interface ColorTweakPanelProps {
  hue: number;
  saturation: number;
  lightness: number;
  contrast: number;
  brightness: number;
  onHslChange: (h: number, s: number, l: number) => void;
  onContrastBrightnessChange: (contrast: number, brightness: number) => void;
}

export function ColorTweakPanel({
  hue,
  saturation,
  lightness,
  contrast,
  brightness,
  onHslChange,
  onContrastBrightnessChange,
}: ColorTweakPanelProps) {
  const handleReset = () => {
    onHslChange(0, 0, 0);
    onContrastBrightnessChange(0, 0);
  };

  return (
    <div className="hsl-section">
      <label className="section-label">Color Adjust</label>

      <div className="hsl-slider-row">
        <span className="hsl-label">H</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={hue}
          onChange={(e) => onHslChange(parseInt(e.target.value), saturation, lightness)}
          aria-label="Hue shift"
        />
        <span className="hsl-value">{hue}</span>
      </div>

      <div className="hsl-slider-row">
        <span className="hsl-label">S</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={saturation}
          onChange={(e) => onHslChange(hue, parseInt(e.target.value), lightness)}
          aria-label="Saturation shift"
        />
        <span className="hsl-value">{saturation}</span>
      </div>

      <div className="hsl-slider-row">
        <span className="hsl-label">L</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={lightness}
          onChange={(e) => onHslChange(hue, saturation, parseInt(e.target.value))}
          aria-label="Lightness shift"
        />
        <span className="hsl-value">{lightness}</span>
      </div>

      <div className="hsl-slider-row">
        <span className="hsl-label">Con</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={contrast}
          onChange={(e) => onContrastBrightnessChange(parseInt(e.target.value), brightness)}
          aria-label="Contrast"
        />
        <span className="hsl-value">{contrast}</span>
      </div>

      <div className="hsl-slider-row">
        <span className="hsl-label">Bri</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={brightness}
          onChange={(e) => onContrastBrightnessChange(contrast, parseInt(e.target.value))}
          aria-label="Brightness"
        />
        <span className="hsl-value">{brightness}</span>
      </div>

      <button className="btn btn-hsl-reset" onClick={handleReset}>
        Reset
      </button>
    </div>
  );
}
