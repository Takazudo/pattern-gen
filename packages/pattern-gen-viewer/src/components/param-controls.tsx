import type { ParamDef } from 'pattern-gen/core/types';

interface ParamControlsProps {
  paramDefs: ParamDef[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
}

export function ParamControls({ paramDefs, values, onChange }: ParamControlsProps) {
  if (paramDefs.length === 0) return null;

  return (
    <div className="param-section">
      <label className="section-label">Parameters</label>
      {paramDefs.map((def) => {
        const value = values[def.key] ?? def.defaultValue;

        switch (def.type) {
          case 'slider':
            return (
              <div key={def.key} className="control-group param-control">
                <label>{def.label}</label>
                <div className="range-row">
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={value}
                    onChange={(e) => onChange(def.key, parseFloat(e.target.value))}
                  />
                  <span className="range-value">
                    {def.step >= 1 ? value.toFixed(0) : value.toFixed(def.step < 0.01 ? 3 : 2)}
                  </span>
                </div>
              </div>
            );

          case 'select':
            return (
              <div key={def.key} className="control-group param-control">
                <label>{def.label}</label>
                <select
                  value={value}
                  onChange={(e) => onChange(def.key, Number(e.target.value))}
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
              <div key={def.key} className="control-group param-control toggle-row">
                <label>{def.label}</label>
                <input
                  type="checkbox"
                  checked={value === 1}
                  onChange={(e) => onChange(def.key, e.target.checked ? 1 : 0)}
                />
              </div>
            );
        }
      })}
    </div>
  );
}
