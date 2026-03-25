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
import { centerDetentToZoom } from 'pattern-gen/core/center-detent';
import { ViewTransformPanel } from './components/view-transform-panel.js';
import { OgpSelectionOverlay } from './components/ogp-selection-overlay.js';

const CANVAS_SIZE = 1200;
const DPR = window.devicePixelRatio || 1;
const OGP_WIDTH = 1200;
const OGP_HEIGHT = 630;

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

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
  translateX: number,
  translateY: number,
  userOverrides: Record<string, number>,
  useTranslate: boolean,
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

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (useTranslate) {
    // Render pattern on a 3x larger offscreen canvas so panning reveals
    // continuous content at any translate position (±100% range).
    const scale = 3;
    const ow = canvas.width * scale;
    const oh = canvas.height * scale;
    const offscreen = new OffscreenCanvas(ow, oh);
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;
    pattern.generate(offCtx as unknown as CanvasRenderingContext2D, {
      ...options,
      width: ow,
      height: oh,
    });

    // Center the oversized canvas, then apply translate offset
    const tx = translateX * canvas.width;
    const ty = translateY * canvas.height;
    const baseOffset = -canvas.width * (scale - 1) / 2; // center: -(scale-1)/2 * size
    ctx.save();
    ctx.translate(baseOffset + tx, baseOffset + ty);
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();
  } else {
    // Direct render — no offscreen canvas, much faster
    pattern.generate(ctx, options);
  }
}

export function App() {
  const [slug, setSlug] = useState(randomSlug);
  const [patternType, setPatternType] = useState(patternRegistry[0].name);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);
  const [zoomSlider, setZoomSlider] = useState(50);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [useTranslate, setUseTranslate] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [ogpMode, setOgpMode] = useState(false);
  // Only tracks params the user explicitly changed via UI controls
  const [userOverrides, setUserOverrides] = useState<Record<string, number>>({});
  // Params locked to their current value across seed changes
  const [fixedParams, setFixedParams] = useState<Set<string>>(new Set());
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

  // Compute actual zoom from slider: center-detent exponential curve
  const zoom = useMemo(() => centerDetentToZoom(zoomSlider), [zoomSlider]);
  const txVal = translateX / 100;
  const tyVal = translateY / 100;

  // Reset non-fixed user overrides and transform when pattern type or slug changes
  useEffect(() => {
    setUserOverrides((prev) => {
      const kept: Record<string, number> = {};
      for (const key of fixedParams) {
        if (key in prev) kept[key] = prev[key];
      }
      return kept;
    });
    setZoomSlider(50);
    setTranslateX(0);
    setTranslateY(0);
    setUseTranslate(false);
  }, [patternType, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate pattern (without HSL) and cache the result
  const generateAndCache = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    generateOnCanvas(canvas, slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      cachedImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }, [slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate]);

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

  const handleFixToggle = useCallback((key: string, fixed: boolean, currentValue: number) => {
    setFixedParams((prev) => {
      const next = new Set(prev);
      if (fixed) {
        next.add(key);
        // Ensure the current value is stored as an override so it persists
        setUserOverrides((p) => ({ ...p, [key]: currentValue }));
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleHslChange = useCallback((h: number, s: number, l: number) => {
    setHslAdjust({ h, s, l });
  }, []);

  const handleTransformChange = useCallback((zs: number, tx: number, ty: number) => {
    setZoomSlider(zs);
    setTranslateX(tx);
    setTranslateY(ty);
  }, []);

  const handleUseTranslateChange = useCallback((enabled: boolean) => {
    setUseTranslate(enabled);
    if (!enabled) {
      setTranslateX(0);
      setTranslateY(0);
    }
  }, []);

  // Randomize only changes slug (seed) — keeps current pattern type
  const randomize = useCallback(() => {
    setSlug(randomSlug());
  }, []);

  // Downloads at the full buffer resolution (CANVAS_SIZE * dpr).
  // To get a fixed 1200×1200 PNG regardless of dpr, draw onto a temporary
  // 1200×1200 canvas before calling toDataURL.
  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    triggerDownload(url, `pattern-${patternType}-${slug}.png`);
  }, [patternType, slug]);

  const handleOgpGenerate = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      const bufW = canvas.width;
      const bufH = canvas.height;
      const elemW = canvasRect.width;
      const elemH = canvasRect.height;

      // Account for object-fit: cover on the square canvas.
      // The canvas content is square but the element fills the viewport,
      // so the visible area is cropped on one axis.
      let renderSize: number;
      let offsetX: number;
      let offsetY: number;
      if (elemW > elemH) {
        renderSize = elemW;
        offsetX = 0;
        offsetY = (elemH - elemW) / 2;
      } else {
        renderSize = elemH;
        offsetX = (elemW - elemH) / 2;
        offsetY = 0;
      }

      const scale = bufW / renderSize;
      const srcX = Math.max(0, (rect.x - canvasRect.left - offsetX) * scale);
      const srcY = Math.max(0, (rect.y - canvasRect.top - offsetY) * scale);
      const srcW = Math.min(rect.width * scale, bufW - srcX);
      const srcH = Math.min(rect.height * scale, bufH - srcY);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = OGP_WIDTH;
      tempCanvas.height = OGP_HEIGHT;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      tempCtx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, OGP_WIDTH, OGP_HEIGHT);
      const url = tempCanvas.toDataURL('image/png');
      triggerDownload(url, `ogp-${patternType}-${slug}.png`);
    },
    [patternType, slug],
  );

  const exitOgpMode = useCallback(() => setOgpMode(false), []);

  const currentPalette = COLOR_SCHEMES[colorSchemeIndex].palette;

  return (
    <div className="app">
      <div className="canvas-layer">
        <canvas ref={canvasRef} width={Math.round(CANVAS_SIZE * DPR)} height={Math.round(CANVAS_SIZE * DPR)} />
      </div>

      {!ogpMode && (
        <>
          {/* Site logo link (top-right) */}
          <a
            className="floating-link site-link"
            href="https://takazudomodular.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={`${import.meta.env.BASE_URL}takazudo.svg`} alt="Takazudo Modular" className="site-logo" />
            <span>Takazudo Modular</span>
          </a>

          {/* Doc link (bottom-right) */}
          <a
            className="floating-link doc-link"
            href="https://zudo-pattern-gen.pages.dev/pj/pattern-gen/doc/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>Doc</span>
          </a>
        </>
      )}

      {ogpMode && (
        <OgpSelectionOverlay
          onGenerate={handleOgpGenerate}
          onExit={exitOgpMode}
        />
      )}

      {!ogpMode && (
        <div className="controls">
        <h1>zudo-pattern-gen</h1>

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

        <button className="btn btn-ogp-mode" onClick={() => setOgpMode(true)}>
          OGP Mode
        </button>

        <button
          className="btn-toggle-details"
          onClick={() => setShowDetails((prev) => !prev)}
          aria-expanded={showDetails}
        >
          Details {showDetails ? '\u25B2' : '\u25BC'}
        </button>

        {showDetails && (
          <div className="details-section">
            <ViewTransformPanel
              zoomSlider={zoomSlider}
              translateX={translateX}
              translateY={translateY}
              useTranslate={useTranslate}
              onChange={handleTransformChange}
              onUseTranslateChange={handleUseTranslateChange}
            />

            <ParamControls
              paramDefs={currentParamDefs}
              values={displayParams}
              fixedParams={fixedParams}
              onChange={handleParamChange}
              onFixToggle={handleFixToggle}
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
      )}
    </div>
  );
}
