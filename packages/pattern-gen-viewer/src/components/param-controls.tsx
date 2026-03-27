import type { ParamDef } from '@takazudo/pattern-gen-core';

interface ParamControlsProps {
  paramDefs: ParamDef[];
  values: Record<string, number>;
  fixedParams: Set<string>;
  onChange: (key: string, value: number) => void;
  onFixToggle: (key: string, fixed: boolean, currentValue: number) => void;
}

export function ParamControls({ paramDefs, values, fixedParams, onChange, onFixToggle }: ParamControlsProps) {
  if (paramDefs.length === 0) return null;

  return (
    <div className="param-section">
      <label className="section-label">Parameters</label>
      {paramDefs.map((def) => {
        const value = values[def.key] ?? def.defaultValue;
        const isFixed = fixedParams.has(def.key);

        switch (def.type) {
          case 'slider':
            return (
              <div key={def.key} className="control-group param-control">
                <div className="param-label-row">
                  <label>{def.label}</label>
                  <label className="fix-toggle">
                    <input
                      type="checkbox"
                      checked={isFixed}
                      onChange={(e) => onFixToggle(def.key, e.target.checked, value)}
                    />
                    Fix
                  </label>
                </div>
                <div className="range-row">
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={value}
                    disabled={isFixed}
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
                <div className="param-label-row">
                  <label>{def.label}</label>
                  <label className="fix-toggle">
                    <input
                      type="checkbox"
                      checked={isFixed}
                      onChange={(e) => onFixToggle(def.key, e.target.checked, value)}
                    />
                    Fix
                  </label>
                </div>
                <select
                  value={value}
                  disabled={isFixed}
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
                <div className="param-label-row">
                  <label>{def.label}</label>
                  <label className="fix-toggle">
                    <input
                      type="checkbox"
                      checked={isFixed}
                      onChange={(e) => onFixToggle(def.key, e.target.checked, value)}
                    />
                    Fix
                  </label>
                </div>
                <input
                  type="checkbox"
                  checked={value === 1}
                  disabled={isFixed}
                  onChange={(e) => onChange(def.key, e.target.checked ? 1 : 0)}
                />
              </div>
            );
        }
      })}
    </div>
  );
}
