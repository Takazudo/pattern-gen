import { useState, useEffect, useRef, useCallback } from 'react';
import HslPicker from './hsl-picker';
import PaletteSelector from './palette-selector';
import { setGlobalOverrides } from '../../lib/iframe-registry';
import { useDraggable } from '../../lib/use-draggable';

interface TweakState {
  palette: string[];
  semanticMappings: Record<string, number>;
}

const DEFAULT_SEMANTIC_MAPPINGS: Record<string, number> = {
  bg: 9,
  fg: 7,
  surface: 10,
  muted: 8,
  accent: 5,
  accentHover: 14,
  success: 2,
  danger: 1,
  warning: 3,
  info: 4,
};

interface PresetDef {
  palette: string[];
  semanticMappings: Record<string, number>;
}

const PRESETS: Record<string, PresetDef> = {
  'Default Dark': {
    palette: [
      '#201f1f',
      '#f43f5e',
      '#22c55e',
      '#f59e0b',
      '#ffffff',
      '#ea580c',
      '#787168',
      '#d6d3d1',
      '#9a9590',
      '#1c1917',
      '#2a2523',
      '#d6d3d1',
      '#fbbf24',
      '#b13a14',
      '#c05a1f',
      '#bab5b0',
    ],
    semanticMappings: {
      bg: 9,
      fg: 7,
      surface: 10,
      muted: 8,
      accent: 5,
      accentHover: 14,
      success: 2,
      danger: 1,
      warning: 3,
      info: 4,
    },
  },
  'Catppuccin Mocha': {
    palette: [
      '#11111b',
      '#f38ba8',
      '#a6e3a1',
      '#f9e2af',
      '#89b4fa',
      '#f5c2e7',
      '#94e2d5',
      '#cdd6f4',
      '#585b70',
      '#1e1e2e',
      '#313244',
      '#b4d0fb',
      '#89dceb',
      '#6c7086',
      '#94e2d5',
      '#bac2de',
    ],
    semanticMappings: {
      bg: 9,
      fg: 7,
      surface: 10,
      muted: 13,
      accent: 4,
      accentHover: 11,
      success: 2,
      danger: 1,
      warning: 3,
      info: 12,
    },
  },
  Dracula: {
    palette: [
      '#21222c',
      '#ff5555',
      '#50fa7b',
      '#f1fa8c',
      '#bd93f9',
      '#ff79c6',
      '#8be9fd',
      '#f8f8f2',
      '#6272a4',
      '#282a36',
      '#86878b',
      '#a4ffff',
      '#d6acff',
      '#ff92df',
      '#69ff94',
      '#ffffff',
    ],
    semanticMappings: {
      bg: 9,
      fg: 7,
      surface: 0,
      muted: 10,
      accent: 6,
      accentHover: 11,
      success: 2,
      danger: 1,
      warning: 3,
      info: 4,
    },
  },
  Nord: {
    palette: [
      '#2e3440',
      '#bf616a',
      '#a3be8c',
      '#ebcb8b',
      '#81a1c1',
      '#b48ead',
      '#88c0d0',
      '#e5e9f0',
      '#4c566a',
      '#3b4252',
      '#616e88',
      '#8fbcbb',
      '#d8dee9',
      '#b48ead',
      '#88c0d0',
      '#eceff4',
    ],
    semanticMappings: {
      bg: 0,
      fg: 12,
      surface: 9,
      muted: 10,
      accent: 6,
      accentHover: 11,
      success: 2,
      danger: 1,
      warning: 3,
      info: 4,
    },
  },
};

const STORAGE_KEY = 'zd-color-tweak-state';
const PRESET_KEY = 'zd-color-tweak-preset';

const SEMANTIC_FIELDS: {
  key: string;
  label: string;
  cssVar: string;
}[] = [
  { key: 'bg', label: 'BG', cssVar: '--zd-semantic-bg' },
  { key: 'fg', label: 'FG', cssVar: '--zd-semantic-fg' },
  { key: 'surface', label: 'Surface', cssVar: '--zd-semantic-surface' },
  { key: 'muted', label: 'Muted', cssVar: '--zd-semantic-muted' },
  { key: 'accent', label: 'Accent', cssVar: '--zd-semantic-accent' },
  { key: 'accentHover', label: 'Acc Hover', cssVar: '--zd-semantic-accent-hover' },
  { key: 'success', label: 'Success', cssVar: '--zd-semantic-success' },
  { key: 'danger', label: 'Danger', cssVar: '--zd-semantic-danger' },
  { key: 'warning', label: 'Warning', cssVar: '--zd-semantic-warning' },
  { key: 'info', label: 'Info', cssVar: '--zd-semantic-info' },
];

const BASE_FIELDS = SEMANTIC_FIELDS.filter((f) => f.key === 'bg' || f.key === 'fg');
const TOKEN_FIELDS = SEMANTIC_FIELDS.filter((f) => f.key !== 'bg' && f.key !== 'fg');

const PANEL_WIDTH = 420;

function loadState(): { state: TweakState; preset: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const preset = localStorage.getItem(PRESET_KEY) || 'Default Dark';
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.palette && !parsed.semanticMappings) {
        const mappings = { ...DEFAULT_SEMANTIC_MAPPINGS };
        return {
          state: { palette: parsed.palette, semanticMappings: mappings },
          preset,
        };
      }
      return { state: parsed, preset };
    }
  } catch {
    // ignore
  }
  return {
    state: {
      palette: [...PRESETS['Default Dark'].palette],
      semanticMappings: { ...PRESETS['Default Dark'].semanticMappings },
    },
    preset: 'Default Dark',
  };
}

function applyToIframes(state: TweakState) {
  const overrides: Record<string, string> = {};

  state.palette.forEach((color, i) => {
    overrides[`--zd-p${i}`] = color;
  });
  SEMANTIC_FIELDS.forEach(({ key, cssVar }) => {
    const paletteIndex = state.semanticMappings[key] ?? DEFAULT_SEMANTIC_MAPPINGS[key] ?? 0;
    const color = state.palette[paletteIndex] ?? '#000000';
    overrides[cssVar] = color;
  });

  // Apply ONLY to iframes — do not touch the page root
  setGlobalOverrides(overrides);
}

function loadInitial() {
  const { state, preset } = loadState();
  return { state, preset };
}

function PaletteSwatch({
  color,
  index,
  onChange,
  mutedColor,
}: {
  color: string;
  index: number;
  onChange: (hex: string) => void;
  mutedColor: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => setIsOpen(false), []);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={`p${index}: ${color}`}
        style={{
          width: '3rem',
          height: '3rem',
          backgroundColor: color,
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 4,
          cursor: 'pointer',
          padding: 0,
        }}
      />
      {isOpen && (
        <HslPicker
          color={color}
          onChange={onChange}
          onClose={handleClose}
          anchorEl={buttonRef.current}
        />
      )}
      <span style={{ fontSize: 10, color: mutedColor, lineHeight: 1 }}>p{index}</span>
    </div>
  );
}

export default function ColorTweakPanel() {
  const [initial] = useState(loadInitial);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TweakState>(initial.state);
  const [preset, setPreset] = useState(initial.preset);
  const panelRef = useRef<HTMLDivElement>(null);
  const { position, onMouseDown, recenter } = useDraggable(PANEL_WIDTH);

  useEffect(() => {
    if (open) recenter();
  }, [open]);

  useEffect(() => {
    applyToIframes(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const updatePalette = (index: number, color: string) => {
    setState((prev) => {
      const palette = [...prev.palette];
      palette[index] = color;
      return { ...prev, palette };
    });
  };

  const updateSemanticMapping = (key: string, paletteIndex: number) => {
    setState((prev) => ({
      ...prev,
      semanticMappings: { ...prev.semanticMappings, [key]: paletteIndex },
    }));
  };

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (!p) return;
    setPreset(name);
    setState({
      palette: [...p.palette],
      semanticMappings: { ...p.semanticMappings },
    });
    try {
      localStorage.setItem(PRESET_KEY, name);
    } catch {
      // ignore
    }
  };

  const resetToPreset = () => {
    applyPreset(preset);
  };

  const bgColor = state.palette[state.semanticMappings.bg ?? 0] ?? '#1c1917';
  const fgColor = state.palette[state.semanticMappings.fg ?? 7] ?? '#d6d3d1';
  const surfaceColor = state.palette[state.semanticMappings.surface ?? 0] ?? '#2a2523';
  const mutedColor = state.palette[state.semanticMappings.muted ?? 8] ?? '#9a9590';

  const toggleButton = (
    <button
      onClick={() => setOpen((o) => !o)}
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 10000,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.15)',
        background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 50%, #22c55e 100%)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        padding: 0,
      }}
      title="Toggle Color Tweak Panel"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1c1917"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="8" r="2" fill="#1c1917" />
        <circle cx="8" cy="14" r="2" fill="#1c1917" />
        <circle cx="16" cy="14" r="2" fill="#1c1917" />
      </svg>
    </button>
  );

  if (!open) return toggleButton;

  const sectionHeadingStyle = {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: mutedColor,
    marginBottom: 6,
    fontWeight: 600,
  };

  return (
    <>
      {toggleButton}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          width: PANEL_WIDTH,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: surfaceColor,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          color: fgColor,
        }}
      >
        {/* Title bar (draggable) */}
        <div
          onMouseDown={onMouseDown}
          style={{
            padding: '8px 12px',
            cursor: 'grab',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13 }}>Color Tweak</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: mutedColor,
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '8px 12px' }}>
          {/* Preset + Reset row */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 10,
              alignItems: 'center',
            }}
          >
            <select
              value={preset}
              onChange={(e) => applyPreset((e.target as HTMLSelectElement).value)}
              style={{
                flex: 1,
                background: bgColor,
                color: fgColor,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {Object.keys(PRESETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={resetToPreset}
              style={{
                background: bgColor,
                color: mutedColor,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Reset
            </button>
          </div>

          {/* Palette (p0-p15) */}
          <div style={{ marginBottom: 12 }}>
            <div style={sectionHeadingStyle}>Palette (p0-p15)</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 4,
              }}
            >
              {state.palette.map((color, i) => (
                <PaletteSwatch
                  key={i}
                  color={color}
                  index={i}
                  onChange={(hex) => updatePalette(i, hex)}
                  mutedColor={mutedColor}
                />
              ))}
            </div>
          </div>

          {/* Base (bg, fg) */}
          <div style={{ marginBottom: 12 }}>
            <div style={sectionHeadingStyle}>Base</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6,
              }}
            >
              {BASE_FIELDS.map(({ key, label }) => (
                <PaletteSelector
                  key={key}
                  label={label}
                  value={state.semanticMappings[key] ?? DEFAULT_SEMANTIC_MAPPINGS[key] ?? 0}
                  palette={state.palette}
                  onChange={(index) => updateSemanticMapping(key, index)}
                />
              ))}
            </div>
          </div>

          {/* Semantic Tokens */}
          <div>
            <div style={sectionHeadingStyle}>Semantic Tokens</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 6,
              }}
            >
              {TOKEN_FIELDS.map(({ key, label }) => (
                <PaletteSelector
                  key={key}
                  label={label}
                  value={state.semanticMappings[key] ?? DEFAULT_SEMANTIC_MAPPINGS[key] ?? 0}
                  palette={state.palette}
                  onChange={(index) => updateSemanticMapping(key, index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
