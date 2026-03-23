import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { hashString } from 'pattern-gen/core/hash';
import { createRandom } from 'pattern-gen/core/seeded-random';
import { COLOR_SCHEMES } from 'pattern-gen/core/color-schemes';
import { patternRegistry, patternsByName } from 'pattern-gen/patterns/index';
import type { PatternOptions, ParamDef } from 'pattern-gen/core/types';
import { ParamControls } from './components/param-controls.js';
import { HslTweakPanel } from './components/hsl-tweak-panel.js';

const CANVAS_SIZE = 1200;

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function applyHslAdjust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjust: { h: number; s: number; l: number },
): void {
  if (adjust.h === 0 && adjust.s === 0 && adjust.l === 0) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    hsl.h = (((hsl.h + adjust.h) % 360) + 360) % 360;
    hsl.s = Math.max(0, Math.min(100, hsl.s + adjust.s));
    hsl.l = Math.max(0, Math.min(100, hsl.l + adjust.l));
    const [nr, ng, nb] = hslToRgb(hsl.h, hsl.s, hsl.l);
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
  }
  ctx.putImageData(imageData, 0, 0);
}

function randomSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function getDefaults(paramDefs: ParamDef[]): Record<string, number> {
  const defaults: Record<string, number> = {};
  for (const def of paramDefs) {
    defaults[def.key] = def.defaultValue;
  }
  return defaults;
}

function generateOnCanvas(
  canvas: HTMLCanvasElement,
  slug: string,
  patternType: string,
  colorSchemeIndex: number,
  zoom: number,
  params: Record<string, number>,
  hslAdjust: { h: number; s: number; l: number },
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
    params: Object.keys(params).length > 0 ? params : undefined,
  };

  pattern.generate(ctx, options);
  applyHslAdjust(ctx, canvas.width, canvas.height, hslAdjust);
}

export function App() {
  const [slug, setSlug] = useState(randomSlug);
  const [patternType, setPatternType] = useState(patternRegistry[0].name);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [params, setParams] = useState<Record<string, number>>({});
  const [hslAdjust, setHslAdjust] = useState({ h: 0, s: 0, l: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get current pattern's paramDefs
  const currentParamDefs = useMemo(() => {
    const pattern = patternsByName.get(patternType);
    return pattern?.paramDefs ?? [];
  }, [patternType]);

  // Reset params to defaults when pattern type changes
  useEffect(() => {
    setParams(getDefaults(currentParamDefs));
  }, [currentParamDefs]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    generateOnCanvas(canvas, slug, patternType, colorSchemeIndex, zoom, params, hslAdjust);
  }, [slug, patternType, colorSchemeIndex, zoom, params, hslAdjust]);

  useEffect(() => {
    render();
  }, [render]);

  const handleParamChange = useCallback((key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
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
              values={params}
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
              onChange={(h, s, l) => setHslAdjust({ h, s, l })}
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
