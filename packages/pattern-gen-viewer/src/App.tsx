import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { hashString } from 'pattern-gen/core/hash';
import { createRandom } from 'pattern-gen/core/seeded-random';
import { COLOR_SCHEMES } from 'pattern-gen/core/color-schemes';
import { patternRegistry, patternsByName } from 'pattern-gen/patterns/index';
import { applyHslAdjust } from 'pattern-gen/core/hsl-adjust';
import { getEffectiveParams } from 'pattern-gen/core/randomize-defaults';
import type { PatternOptions, ParamDef } from 'pattern-gen/core/types';
import { ParamControls } from './components/param-controls.js';
import { HslTweakPanel } from './components/hsl-tweak-panel.js';

const CANVAS_SIZE = 1200;

function randomSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function generateOnCanvas(
  canvas: HTMLCanvasElement,
  slug: string,
  patternType: string,
  colorSchemeIndex: number,
  zoom: number,
  userOverrides: Record<string, number>,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const pattern = patternsByName.get(patternType);
  if (!pattern) return;

  const seed = hashString(slug);
  const rand = createRandom(seed);
  const scheme = COLOR_SCHEMES[colorSchemeIndex];

  const options: PatternOptions = {
    width: canvas.width,
    height: canvas.height,
    rand,
    colorScheme: scheme,
    zoom,
    // Only pass user-overridden params; randomizeDefaults inside generate()
    // handles seed-randomization for non-overridden slider params
    params: Object.keys(userOverrides).length > 0 ? userOverrides : undefined,
  };

  pattern.generate(ctx, options);
}

export function App() {
  const [slug, setSlug] = useState(randomSlug);
  const [patternType, setPatternType] = useState(patternRegistry[0].name);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  // Only tracks params the user explicitly changed via UI controls
  const [userOverrides, setUserOverrides] = useState<Record<string, number>>({});
  const [hslAdjust, setHslAdjust] = useState({ h: 0, s: 0, l: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cachedImageDataRef = useRef<ImageData | null>(null);

  // Get current pattern's paramDefs
  const currentParamDefs = useMemo(() => {
    const pattern = patternsByName.get(patternType);
    return pattern?.paramDefs ?? [];
  }, [patternType]);

  // Compute seed-randomized defaults for UI display
  // Uses same seed + PRNG to produce identical values to what generate() uses
  const seedRandomizedParams = useMemo(() => {
    if (currentParamDefs.length === 0) return {};
    const seed = hashString(slug);
    return getEffectiveParams(seed, currentParamDefs, createRandom);
  }, [slug, currentParamDefs]);

  // Display values: seed-randomized merged with user overrides
  const displayParams = useMemo(() => ({
    ...seedRandomizedParams,
    ...userOverrides,
  }), [seedRandomizedParams, userOverrides]);

  // Reset user overrides when pattern type changes
  useEffect(() => {
    setUserOverrides({});
  }, [patternType]);

  // Also reset user overrides when slug changes (new seed = fresh randomization)
  useEffect(() => {
    setUserOverrides({});
  }, [slug]);

  // Generate pattern (without HSL) and cache the result
  const generateAndCache = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    generateOnCanvas(canvas, slug, patternType, colorSchemeIndex, zoom, userOverrides);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      cachedImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }, [slug, patternType, colorSchemeIndex, zoom, userOverrides]);

  // Apply HSL adjustment from cached ImageData (fast — no re-generation)
  const applyHsl = useCallback(() => {
    const canvas = canvasRef.current;
    const cached = cachedImageDataRef.current;
    if (!canvas || !cached) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(cached, 0, 0);
    applyHslAdjust(ctx, canvas.width, canvas.height, {
      h: hslAdjust.h,
      s: hslAdjust.s,
      l: hslAdjust.l,
    });
  }, [hslAdjust]);

  // Re-generate pattern when pattern params change
  useEffect(() => {
    generateAndCache();
  }, [generateAndCache]);

  // Re-apply HSL when either pattern or HSL changes
  useEffect(() => {
    applyHsl();
  }, [applyHsl, generateAndCache]);

  const handleParamChange = useCallback((key: string, value: number) => {
    setUserOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleHslChange = useCallback((h: number, s: number, l: number) => {
    setHslAdjust({ h, s, l });
  }, []);

  // Randomize only changes slug (seed) — keeps current pattern type
  const randomize = useCallback(() => {
    setSlug(randomSlug());
  }, []);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `pattern-${patternType}-${slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [patternType, slug]);

  const currentPalette = COLOR_SCHEMES[colorSchemeIndex].palette;

  return (
    <div className="app">
      <div className="canvas-layer">
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
      </div>

      <div className="controls">
        <h1>pattern-gen</h1>

        <div className="control-group">
          <label htmlFor="type-select">Pattern Type</label>
          <select
            id="type-select"
            value={patternType}
            onChange={(e) => setPatternType(e.target.value)}
          >
            {patternRegistry.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="slug-input">Slug / Seed</label>
          <div className="slug-row">
            <input
              id="slug-input"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <button className="btn btn-random" onClick={randomize}>
              Random
            </button>
          </div>
        </div>

        <button
          className="btn-toggle-details"
          onClick={() => setShowDetails((prev) => !prev)}
          aria-expanded={showDetails}
        >
          Details {showDetails ? '\u25B2' : '\u25BC'}
        </button>

        {showDetails && (
          <div className="details-section">
            <div className="control-group">
              <label htmlFor="zoom-input">Zoom</label>
              <div className="range-row">
                <input
                  id="zoom-input"
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                />
                <span className="range-value">{zoom.toFixed(1)}</span>
              </div>
            </div>

            <ParamControls
              paramDefs={currentParamDefs}
              values={displayParams}
              onChange={handleParamChange}
            />

            <div className="control-group">
              <label htmlFor="scheme-select">Color Scheme</label>
              <select
                id="scheme-select"
                className="scheme-select"
                value={colorSchemeIndex}
                onChange={(e) => setColorSchemeIndex(Number(e.target.value))}
              >
                {COLOR_SCHEMES.map((scheme, i) => (
                  <option key={scheme.name} value={i}>
                    {scheme.name}
                  </option>
                ))}
              </select>
              <div className="scheme-preview" aria-hidden="true">
                {currentPalette.map((color, i) => (
                  <span
                    key={i}
                    className="scheme-dot"
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <HslTweakPanel
              hue={hslAdjust.h}
              saturation={hslAdjust.s}
              lightness={hslAdjust.l}
              onChange={handleHslChange}
            />

            <div className="button-row">
              <button className="btn btn-download" onClick={download}>
                Download PNG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
