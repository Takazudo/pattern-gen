import { useState, useCallback, useRef, type CSSProperties } from 'react';
import type { ControlDef, ControlsMap } from './control-types';

interface ControlsPanelProps {
  controls: ControlsMap;
  onChange: (props: Record<string, unknown>) => void;
}

function getDefaults(controls: ControlsMap): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(controls)) {
    defaults[key] = def.default;
  }
  return defaults;
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').trim();
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: '#a6adc8',
  minWidth: 80,
  flexShrink: 0,
};

const inputBaseStyle: CSSProperties = {
  background: '#1e1e2e',
  color: '#cdd6f4',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
};

function TextControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      style={{ ...inputBaseStyle, flex: 1, minWidth: 0 }}
    />
  );
}

function BooleanControl({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      style={{ accentColor: '#ea580c', cursor: 'pointer', width: 16, height: 16 }}
    />
  );
}

function NumberControl({
  value,
  onChange,
  def,
}: {
  value: number;
  onChange: (v: number) => void;
  def: ControlDef & { type: 'number' };
}) {
  const min = def.min ?? 0;
  const max = def.max ?? 100;
  const step = def.step ?? 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        style={{ flex: 1, height: 6, cursor: 'pointer', accentColor: '#ea580c' }}
      />
      <span
        style={{
          fontSize: 11,
          color: '#6c7086',
          fontFamily: 'ui-monospace, monospace',
          minWidth: 28,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SelectControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      style={{
        ...inputBaseStyle,
        cursor: 'pointer',
        flex: 1,
        minWidth: 0,
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function ColorControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <input
        type="color"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{
          width: 28,
          height: 22,
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 3,
          cursor: 'pointer',
          padding: 0,
          background: 'none',
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: '#6c7086',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ControlRow({
  name,
  def,
  value,
  onChange,
}: {
  name: string;
  def: ControlDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={labelStyle}>{humanize(name)}</span>
      {def.type === 'text' && <TextControl value={value as string} onChange={onChange} />}
      {def.type === 'boolean' && <BooleanControl value={value as boolean} onChange={onChange} />}
      {def.type === 'number' && (
        <NumberControl
          value={value as number}
          onChange={onChange as (v: number) => void}
          def={def}
        />
      )}
      {def.type === 'select' && (
        <SelectControl
          value={value as string}
          onChange={onChange as (v: string) => void}
          options={def.options}
        />
      )}
      {def.type === 'color' && (
        <ColorControl value={value as string} onChange={onChange as (v: string) => void} />
      )}
    </div>
  );
}

export function ControlsPanel({ controls, onChange }: ControlsPanelProps) {
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>(() => getDefaults(controls));
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      const next = { ...valuesRef.current, [key]: value };
      setValues(next);
      onChange(next);
    },
    [onChange],
  );

  const handleReset = useCallback(() => {
    const defaults = getDefaults(controls);
    setValues(defaults);
    onChange(defaults);
  }, [controls, onChange]);

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: '#1e1e2e',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '6px 12px',
          fontSize: 11,
          fontWeight: 500,
          color: '#a6adc8',
          background: '#313244',
          border: 'none',
          cursor: 'pointer',
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            transition: 'transform 0.15s',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          &#9654;
        </span>
        Controls
      </button>
      {open && (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(controls).map(([key, def]) => (
            <ControlRow
              key={key}
              name={key}
              def={def}
              value={values[key]}
              onChange={(v) => handleChange(key, v)}
            />
          ))}
          <button
            type="button"
            onClick={handleReset}
            style={{
              marginTop: 4,
              background: '#313244',
              color: '#6c7086',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 10,
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
