import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { hashString } from 'pattern-gen/core/hash';
import { createRandom } from 'pattern-gen/core/seeded-random';
import { COLOR_SCHEMES } from 'pattern-gen/core/color-schemes';
import { patternRegistry, patternsByName } from 'pattern-gen/patterns/index';
import type { PatternOptions, ParamDef } from 'pattern-gen/core/types';
import { ParamControls } from './components/param-controls.js';

const CANVAS_SIZE = 1200;

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
}

export function App() {
  const [slug, setSlug] = useState(randomSlug);
  const [patternType, setPatternType] = useState(patternRegistry[0].name);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [params, setParams] = useState<Record<string, number>>({});
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
    generateOnCanvas(canvas, slug, patternType, colorSchemeIndex, zoom, params);
  }, [slug, patternType, colorSchemeIndex, zoom, params]);

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
