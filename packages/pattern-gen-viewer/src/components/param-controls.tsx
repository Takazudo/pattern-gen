import { useState } from 'react';
import type { ParamDef } from '@takazudo/pattern-gen-core';

function EditableRangeValue({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const formatted = step >= 1 ? value.toFixed(0) : value.toFixed(step < 0.01 ? 3 : 2);

  const handleFocus = () => {
    setDraft(formatted);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setDraft(formatted);
      setIsEditing(false);
    }
  };

  return (
    <input
      type="text"
      className="range-value range-value-editable"
      value={isEditing ? draft : formatted}
      onFocus={handleFocus}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

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
                  <label htmlFor={`param-${def.key}`}>{def.label}</label>
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
                    id={`param-${def.key}`}
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={value}
                    disabled={isFixed}
                    onChange={(e) => onChange(def.key, parseFloat(e.target.value))}
                  />
                  <EditableRangeValue value={value} step={def.step} onChange={(v) => onChange(def.key, v)} />
                </div>
              </div>
            );

          case 'select':
            return (
              <div key={def.key} className="control-group param-control">
                <div className="param-label-row">
                  <label htmlFor={`param-${def.key}`}>{def.label}</label>
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
                  id={`param-${def.key}`}
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
                  <label htmlFor={`param-${def.key}`}>{def.label}</label>
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
                  id={`param-${def.key}`}
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
