interface HslTweakPanelProps {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (h: number, s: number, l: number) => void;
}

export function HslTweakPanel({
  hue,
  saturation,
  lightness,
  onChange,
}: HslTweakPanelProps) {
  const handleReset = () => onChange(0, 0, 0);

  return (
    <div className="hsl-section">
      <label className="section-label">HSL Adjust</label>

      <div className="hsl-slider-row">
        <span className="hsl-label">H</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={hue}
          onChange={(e) => onChange(parseInt(e.target.value), saturation, lightness)}
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
          onChange={(e) => onChange(hue, parseInt(e.target.value), lightness)}
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
          onChange={(e) => onChange(hue, saturation, parseInt(e.target.value))}
        />
        <span className="hsl-value">{lightness}</span>
      </div>

      <button className="btn btn-hsl-reset" onClick={handleReset}>
        Reset
      </button>
    </div>
  );
}
