import { useState, useEffect, useCallback } from 'react';
import { tokenConfig } from './token-defs';
import { useDraggable } from '../../lib/use-draggable';
import { setGlobalOverrides, resetGlobalOverrides } from '../../lib/iframe-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SystemKey = 'zd' | 'sg';

interface TokenDef {
  variable: string;
  defaultValue: string;
  label: string;
  type: 'color' | 'length' | 'weight' | 'lineheight';
  unit: string; // 'px' | 'rem' | '' (unitless)
  min: number;
  max: number;
  step: number;
}

interface TokenGroup {
  title: string;
  tokens: TokenDef[];
}

interface TokenSystem {
  label: string;
  key: SystemKey;
  groups: TokenGroup[];
}

// ---------------------------------------------------------------------------
// Helpers to build TokenDef arrays from tokenConfig
// ---------------------------------------------------------------------------

function colorDef(variable: string, defaultValue: string, label: string): TokenDef {
  return { variable, defaultValue, label, type: 'color', unit: '', min: 0, max: 0, step: 0 };
}

function lengthDef(
  variable: string,
  defaultValue: string,
  label: string,
  unit: string,
  max: number,
  step = 1,
): TokenDef {
  return { variable, defaultValue, label, type: 'length', unit, min: 0, max, step };
}

function weightDef(variable: string, defaultValue: string, label: string): TokenDef {
  return {
    variable,
    defaultValue,
    label,
    type: 'weight',
    unit: '',
    min: 100,
    max: 900,
    step: 100,
  };
}

function lineHeightDef(variable: string, defaultValue: string, label: string): TokenDef {
  return {
    variable,
    defaultValue,
    label,
    type: 'lineheight',
    unit: '',
    min: 1,
    max: 3,
    step: 0.05,
  };
}

// ---------------------------------------------------------------------------
// Token system definitions
// ---------------------------------------------------------------------------

const PALETTE_SYSTEM: TokenSystem = {
  label: 'Palette',
  key: 'zd',
  groups: [
    {
      title: 'Palette Colors (p0-p15)',
      tokens: tokenConfig.colors.palette.map((t) =>
        colorDef(t.variable, t.defaultValue, t.label),
      ),
    },
    {
      title: 'Semantic Colors',
      tokens: tokenConfig.colors.semantic.map((t) =>
        colorDef(t.variable, t.defaultValue, t.label),
      ),
    },
  ],
};

const SG_SYSTEM: TokenSystem = {
  label: 'Styleguide',
  key: 'sg',
  groups: [
    {
      title: 'Horizontal Spacing (hsp)',
      tokens: [
        lengthDef('--spacing-hsp-2xs', '0.125rem', 'hsp-2xs', 'rem', 4, 0.025),
        lengthDef('--spacing-hsp-xs', '0.375rem', 'hsp-xs', 'rem', 4, 0.025),
        lengthDef('--spacing-hsp-sm', '0.5rem', 'hsp-sm', 'rem', 4, 0.025),
        lengthDef('--spacing-hsp-md', '0.75rem', 'hsp-md', 'rem', 4, 0.025),
        lengthDef('--spacing-hsp-lg', '1rem', 'hsp-lg', 'rem', 4, 0.025),
        lengthDef('--spacing-hsp-xl', '1.5rem', 'hsp-xl', 'rem', 4, 0.025),
        lengthDef('--spacing-hsp-2xl', '2rem', 'hsp-2xl', 'rem', 6, 0.025),
      ],
    },
    {
      title: 'Vertical Spacing (vsp)',
      tokens: [
        lengthDef('--spacing-vsp-3xs', '0.25rem', 'vsp-3xs', 'rem', 6, 0.025),
        lengthDef('--spacing-vsp-2xs', '0.4375rem', 'vsp-2xs', 'rem', 6, 0.025),
        lengthDef('--spacing-vsp-xs', '0.875rem', 'vsp-xs', 'rem', 6, 0.025),
        lengthDef('--spacing-vsp-sm', '1.25rem', 'vsp-sm', 'rem', 6, 0.025),
        lengthDef('--spacing-vsp-md', '1.5rem', 'vsp-md', 'rem', 6, 0.025),
        lengthDef('--spacing-vsp-lg', '1.75rem', 'vsp-lg', 'rem', 6, 0.025),
        lengthDef('--spacing-vsp-xl', '2.5rem', 'vsp-xl', 'rem', 6, 0.025),
        lengthDef('--spacing-vsp-2xl', '3.5rem', 'vsp-2xl', 'rem', 8, 0.025),
      ],
    },
    {
      title: 'Font Sizes',
      tokens: [
        lengthDef('--text-caption', '0.875rem', 'caption', 'rem', 4, 0.025),
        lengthDef('--text-small', '1rem', 'small', 'rem', 4, 0.025),
        lengthDef('--text-body', '1.2rem', 'body', 'rem', 4, 0.025),
        lengthDef('--text-subheading', '1.4rem', 'subheading', 'rem', 4, 0.025),
        lengthDef('--text-heading', '3rem', 'heading', 'rem', 6, 0.05),
        lengthDef('--text-display', '3.75rem', 'display', 'rem', 8, 0.05),
      ],
    },
    {
      title: 'Font Weights',
      tokens: [
        weightDef('--font-weight-normal', '400', 'normal'),
        weightDef('--font-weight-medium', '500', 'medium'),
        weightDef('--font-weight-semibold', '600', 'semibold'),
        weightDef('--font-weight-bold', '700', 'bold'),
      ],
    },
    {
      title: 'Line Heights',
      tokens: [
        lineHeightDef('--leading-tight', '1.25', 'tight'),
        lineHeightDef('--leading-snug', '1.375', 'snug'),
        lineHeightDef('--leading-normal', '1.5', 'normal'),
        lineHeightDef('--leading-relaxed', '1.625', 'relaxed'),
      ],
    },
  ],
};

const TOKEN_SYSTEMS: TokenSystem[] = [PALETTE_SYSTEM, SG_SYSTEM];

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'zd-token-tweak-state-v2';

/** Flat map of variable → default value for every token across all systems */
function allDefaults(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const sys of TOKEN_SYSTEMS) {
    for (const group of sys.groups) {
      for (const token of group.tokens) {
        map[token.variable] = token.defaultValue;
      }
    }
  }
  return map;
}

function loadState(): Record<string, string> {
  const defaults = allDefaults();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return defaults;
}

function tokenValueWithUnit(token: TokenDef, rawValue: string): string {
  if (token.type === 'color') return rawValue;
  if (token.unit) return parseFloat(rawValue) + token.unit;
  return rawValue;
}

function stripUnit(value: string): string {
  const num = parseFloat(value);
  return isNaN(num) ? value : num.toString();
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 350;
const BG = '#1e1e2e';
const SURFACE = '#313244';
const FG = '#cdd6f4';
const MUTED = '#6c7086';
const LABEL_COLOR = '#a6adc8';
const ACCENT = '#ea580c';
const INPUT_BG = '#45475a';
const INPUT_BORDER = 'rgba(255,255,255,0.1)';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ColorTokenRow({
  token,
  value,
  onChange,
}: {
  token: TokenDef;
  value: string;
  onChange: (v: string) => void;
}) {
  // Normalize value for the color input (needs 6-digit hex)
  // Normalize to 7-char hex (#RRGGBB) for the color input
  // Handles 9-char (#RRGGBBaa), 4-char (#RGB), and non-hex (oklch/var) gracefully
  const hexValue =
    value.startsWith('#') && value.length === 7
      ? value
      : value.startsWith('#') && value.length > 7
        ? value.slice(0, 7)
        : '#000000';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={hexValue}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{
          width: 28,
          height: 22,
          border: `1px solid ${INPUT_BORDER}`,
          borderRadius: 3,
          cursor: 'pointer',
          padding: 0,
          background: 'none',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: LABEL_COLOR, flex: 1, minWidth: 0 }}>{token.label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{
          width: 72,
          background: INPUT_BG,
          color: FG,
          border: `1px solid ${INPUT_BORDER}`,
          borderRadius: 3,
          padding: '1px 4px',
          fontSize: 10,
          fontFamily: 'ui-monospace, monospace',
          textAlign: 'right',
          flexShrink: 0,
        }}
      />
    </div>
  );
}

function SliderTokenRow({
  token,
  value,
  onChange,
}: {
  token: TokenDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const numValue = parseFloat(value) || 0;
  const displayValue = numValue + (token.unit || '');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: LABEL_COLOR }}>{token.label}</span>
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            const num = parseFloat((e.target as HTMLInputElement).value);
            if (!isNaN(num)) onChange(num.toString());
          }}
          style={{
            width: 60,
            background: INPUT_BG,
            color: FG,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 3,
            padding: '1px 4px',
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
            textAlign: 'right',
          }}
        />
      </div>
      <input
        type="range"
        min={token.min}
        max={token.max}
        step={token.step}
        value={numValue}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{ width: '100%', height: 6, cursor: 'pointer', accentColor: ACCENT }}
      />
    </div>
  );
}

function WeightTokenRow({
  token,
  value,
  onChange,
}: {
  token: TokenDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const WEIGHTS = [
    { value: '100', label: 'Thin' },
    { value: '200', label: 'Extra Light' },
    { value: '300', label: 'Light' },
    { value: '400', label: 'Normal' },
    { value: '500', label: 'Medium' },
    { value: '600', label: 'Semibold' },
    { value: '700', label: 'Bold' },
    { value: '800', label: 'Extra Bold' },
    { value: '900', label: 'Black' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: LABEL_COLOR, flex: 1 }}>{token.label}</span>
      <select
        value={stripUnit(value)}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
        style={{
          width: 110,
          background: INPUT_BG,
          color: FG,
          border: `1px solid ${INPUT_BORDER}`,
          borderRadius: 3,
          padding: '2px 4px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {WEIGHTS.map((w) => (
          <option key={w.value} value={w.value}>
            {w.value} {w.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TokenGroupSection({
  group,
  values,
  onUpdate,
}: {
  group: TokenGroup;
  values: Record<string, string>;
  onUpdate: (variable: string, value: string) => void;
}) {
  const sectionHeaderStyle = {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: MUTED,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: 600,
  };

  const isColorGroup = group.tokens.length > 0 && group.tokens[0].type === 'color';

  return (
    <div>
      <div style={sectionHeaderStyle}>{group.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isColorGroup ? 5 : 8 }}>
        {group.tokens.map((token) => {
          const rawValue = values[token.variable] ?? token.defaultValue;
          if (token.type === 'color') {
            return (
              <ColorTokenRow
                key={token.variable}
                token={token}
                value={rawValue}
                onChange={(v) => onUpdate(token.variable, v)}
              />
            );
          }
          if (token.type === 'weight') {
            return (
              <WeightTokenRow
                key={token.variable}
                token={token}
                value={rawValue}
                onChange={(v) => onUpdate(token.variable, v)}
              />
            );
          }
          // length and lineheight both use slider
          return (
            <SliderTokenRow
              key={token.variable}
              token={token}
              value={stripUnit(rawValue)}
              onChange={(v) => onUpdate(token.variable, v)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TokenTweakPanel() {
  const [open, setOpen] = useState(false);
  const [activeSystem, setActiveSystem] = useState<SystemKey>('zd');
  const [values, setValues] = useState<Record<string, string>>(loadState);
  const { position, onMouseDown, recenter } = useDraggable(PANEL_WIDTH);

  // Listen for toggle event from header button
  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener('toggle-color-tweak-panel', handler);
    return () => window.removeEventListener('toggle-color-tweak-panel', handler);
  }, []);

  // Recenter when opened
  useEffect(() => {
    if (open) recenter();
  }, [open, recenter]);

  // Apply all values to both document root and iframes
  useEffect(() => {
    const overrides: Record<string, string> = {};
    const root = document.documentElement;

    for (const sys of TOKEN_SYSTEMS) {
      for (const group of sys.groups) {
        for (const token of group.tokens) {
          const rawValue = values[token.variable] ?? token.defaultValue;
          const cssValue = tokenValueWithUnit(token, rawValue);
          overrides[token.variable] = cssValue;
          root.style.setProperty(token.variable, cssValue);
        }
      }
    }

    // Also apply to iframes
    setGlobalOverrides(overrides);

    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // ignore
    }
  }, [values]);

  const updateValue = useCallback((variable: string, value: string) => {
    setValues((prev) => ({ ...prev, [variable]: value }));
  }, []);

  const handleReset = useCallback(() => {
    const defaults = allDefaults();
    setValues(defaults);

    // Remove overrides from document root
    const root = document.documentElement;
    for (const variable of Object.keys(defaults)) {
      root.style.removeProperty(variable);
    }
    resetGlobalOverrides();

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  if (!open) return null;

  const currentSystem = TOKEN_SYSTEMS.find((s) => s.key === activeSystem) ?? TOKEN_SYSTEMS[0];

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        width: PANEL_WIDTH,
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        background: SURFACE,
        border: `1px solid ${INPUT_BORDER}`,
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        color: FG,
      }}
    >
      {/* Title bar (draggable) */}
      <div
        onMouseDown={onMouseDown}
        style={{
          padding: '8px 12px',
          cursor: 'grab',
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>Token Tweak</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            color: MUTED,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      </div>

      {/* System tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TOKEN_SYSTEMS.map((sys) => (
          <button
            key={sys.key}
            onClick={() => setActiveSystem(sys.key)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: 11,
              fontWeight: activeSystem === sys.key ? 600 : 400,
              color: activeSystem === sys.key ? ACCENT : MUTED,
              background: 'none',
              border: 'none',
              borderBottom:
                activeSystem === sys.key ? `2px solid ${ACCENT}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {sys.label}
          </button>
        ))}
      </div>

      {/* Token groups */}
      <div style={{ padding: '4px 12px 12px' }}>
        {currentSystem.groups.map((group) => (
          <TokenGroupSection
            key={group.title}
            group={group}
            values={values}
            onUpdate={updateValue}
          />
        ))}

        {/* Reset button */}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={handleReset}
            style={{
              width: '100%',
              background: BG,
              color: MUTED,
              border: `1px solid ${INPUT_BORDER}`,
              borderRadius: 4,
              padding: '5px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Reset All to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
