import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  hashString,
  createRandom,
  COLOR_SCHEMES,
  applyHslAdjust,
  getEffectiveParams,
  centerDetentToZoom,
  serializeOgpConfig,
  OGP_WIDTH,
  OGP_HEIGHT,
} from '@takazudo/pattern-gen-core';
import type { PatternOptions, ParamDef, OgpConfig } from '@takazudo/pattern-gen-core';
import { patternRegistry, patternsByName } from '@takazudo/pattern-gen-generators';
import { ParamControls } from './components/param-controls.js';
import { HslTweakPanel } from './components/hsl-tweak-panel.js';
import { ViewTransformPanel } from './components/view-transform-panel.js';
import { OgpSelectionOverlay, getOutputDimensions } from './components/ogp-selection-overlay.js';
import type { AspectConfig } from './components/ogp-selection-overlay.js';
import { OgpEditor } from './components/ogp-editor.js';
import { ImageOverlayPanel } from './components/image-overlay-panel.js';
import { removeBackground, applyThreshold } from '@takazudo/pattern-gen-image-processor';
import type { ProcessedImage } from '@takazudo/pattern-gen-image-processor';

const CANVAS_SIZE = 1200;
const DPR = window.devicePixelRatio || 1;

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Map a viewport rect to canvas buffer coordinates, accounting for object-fit: cover. */
function viewportRectToBufferRect(
  viewportRect: { x: number; y: number; width: number; height: number },
  canvas: HTMLCanvasElement,
): { srcX: number; srcY: number; srcW: number; srcH: number } {
  const canvasRect = canvas.getBoundingClientRect();
  const bufW = canvas.width;
  const bufH = canvas.height;
  const elemW = canvasRect.width;
  const elemH = canvasRect.height;

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
  const srcX = Math.max(0, (viewportRect.x - canvasRect.left - offsetX) * scale);
  const srcY = Math.max(0, (viewportRect.y - canvasRect.top - offsetY) * scale);
  const srcW = Math.min(viewportRect.width * scale, bufW - srcX);
  const srcH = Math.min(viewportRect.height * scale, bufH - srcY);

  return { srcX, srcY, srcW, srcH };
}

function buildOgpConfig(
  viewportRect: { x: number; y: number; width: number; height: number },
  canvas: HTMLCanvasElement,
  state: {
    slug: string;
    patternType: string;
    colorSchemeName: string;
    zoom: number;
    txVal: number;
    tyVal: number;
    useTranslate: boolean;
    displayParams: Record<string, number>;
    hslAdjust: { h: number; s: number; l: number };
  },
): OgpConfig {
  const { srcX, srcY, srcW, srcH } = viewportRectToBufferRect(viewportRect, canvas);
  const bufW = canvas.width;
  const bufH = canvas.height;

  return {
    version: 1,
    slug: state.slug,
    type: state.patternType,
    colorScheme: state.colorSchemeName,
    zoom: state.zoom,
    translateX: state.txVal,
    translateY: state.tyVal,
    useTranslate: state.useTranslate,
    params: { ...state.displayParams },
    hsl: { ...state.hslAdjust },
    crop: {
      x: srcX / bufW,
      y: srcY / bufH,
      width: srcW / bufW,
      height: srcH / bufH,
    },
  };
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
  const [ogpEditMode, setOgpEditMode] = useState(false);
  const [editorBgImage, setEditorBgImage] = useState<ImageBitmap | null>(null);
  const [editorBgConfig, setEditorBgConfig] = useState<OgpConfig | null>(null);
  const [editorOutputSize, setEditorOutputSize] = useState({ width: OGP_WIDTH, height: OGP_HEIGHT });
  // Only tracks params the user explicitly changed via UI controls
  const [userOverrides, setUserOverrides] = useState<Record<string, number>>({});
  // Params locked to their current value across seed changes
  const [fixedParams, setFixedParams] = useState<Set<string>>(new Set());
  const [hslAdjust, setHslAdjust] = useState({ h: 0, s: 0, l: 0 });
  // Image overlay state
  const [importedImage, setImportedImage] = useState<ProcessedImage | null>(null);
  const [bgThreshold, setBgThreshold] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cachedImageDataRef = useRef<ImageData | null>(null);
  const thresholdedRef = useRef<ImageData | null>(null);

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

  // Cache thresholded image data — only recompute when threshold or image changes,
  // not on every opacity slider move
  useEffect(() => {
    if (!importedImage) {
      thresholdedRef.current = null;
      return;
    }
    thresholdedRef.current = applyThreshold(importedImage, { threshold: bgThreshold });
  }, [importedImage, bgThreshold]);

  // Unified rendering pipeline: pattern → HSL → optional image overlay.
  // Consolidates into a single effect to avoid canvas race conditions between
  // multiple effects writing to the same canvas.
  useEffect(() => {
    applyHsl();

    // Composite image overlay on top if present
    const thresholded = thresholdedRef.current;
    if (!importedImage || !thresholded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tempCanvas = new OffscreenCanvas(thresholded.width, thresholded.height);
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.putImageData(thresholded, 0, 0);

    // Scale to fit (contain) within the main canvas
    const scale = Math.min(
      canvas.width / thresholded.width,
      canvas.height / thresholded.height,
    );
    const drawW = thresholded.width * scale;
    const drawH = thresholded.height * scale;
    const drawX = (canvas.width - drawW) / 2;
    const drawY = (canvas.height - drawH) / 2;

    ctx.save();
    ctx.globalAlpha = overlayOpacity / 100;
    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [applyHsl, generateAndCache, importedImage, bgThreshold, overlayOpacity]);

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

  const [importError, setImportError] = useState<string | null>(null);

  const handleImageImport = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setImportError(null);
    try {
      const processed = await removeBackground(file, {
        onProgress: (p: number) => setProcessingProgress(Math.round(p * 100)),
      });
      setImportedImage(processed);
      setBgThreshold(0);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Background removal failed');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleImageClear = useCallback(() => {
    setImportedImage(null);
    setBgThreshold(0);
    setOverlayOpacity(100);
    setImportError(null);
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

  // Composite the imported image overlay onto a canvas (used by OGP export paths)
  const compositeOverlay = useCallback((ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
    const thresholded = thresholdedRef.current;
    if (!importedImage || !thresholded) return;

    const tempCanvas = new OffscreenCanvas(thresholded.width, thresholded.height);
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.putImageData(thresholded, 0, 0);

    const scale = Math.min(canvasW / thresholded.width, canvasH / thresholded.height);
    const drawW = thresholded.width * scale;
    const drawH = thresholded.height * scale;
    const drawX = (canvasW - drawW) / 2;
    const drawY = (canvasH - drawH) / 2;

    ctx.save();
    ctx.globalAlpha = overlayOpacity / 100;
    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [importedImage, overlayOpacity]);

  const handleOgpGenerate = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Compute normalized crop (0-1 fractions of canvas buffer)
      const { srcX, srcY, srcW, srcH } = viewportRectToBufferRect(rect, canvas);
      const bufW = canvas.width;
      const bufH = canvas.height;
      const cropX = srcX / bufW;
      const cropY = srcY / bufH;
      const cropW = srcW / bufW;
      const cropH = srcH / bufH;

      // Re-render at a resolution where the crop region has enough pixels
      // for a sharp 1200x630 output (instead of upscaling from displayed canvas)
      const renderSize = Math.min(4000, Math.max(
        CANVAS_SIZE,
        Math.ceil(OGP_WIDTH / cropW),
        Math.ceil(OGP_HEIGHT / cropH),
      ));

      const hiResCanvas = document.createElement('canvas');
      hiResCanvas.width = renderSize;
      hiResCanvas.height = renderSize;
      generateOnCanvas(hiResCanvas, slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate);

      // Apply HSL adjustments
      const hiResCtx = hiResCanvas.getContext('2d');
      if (!hiResCtx) return;
      if (hslAdjust.h !== 0 || hslAdjust.s !== 0 || hslAdjust.l !== 0) {
        applyHslAdjust(hiResCtx, renderSize, renderSize, hslAdjust);
      }

      // Composite image overlay if present
      compositeOverlay(hiResCtx, renderSize, renderSize);

      // Crop and scale to OGP dimensions
      const cx = Math.round(cropX * renderSize);
      const cy = Math.round(cropY * renderSize);
      const cw = Math.min(Math.round(cropW * renderSize), renderSize - cx);
      const ch = Math.min(Math.round(cropH * renderSize), renderSize - cy);

      const ogpCanvas = document.createElement('canvas');
      ogpCanvas.width = OGP_WIDTH;
      ogpCanvas.height = OGP_HEIGHT;
      const ogpCtx = ogpCanvas.getContext('2d');
      if (!ogpCtx) return;
      ogpCtx.drawImage(hiResCanvas, cx, cy, cw, ch, 0, 0, OGP_WIDTH, OGP_HEIGHT);

      const url = ogpCanvas.toDataURL('image/png');
      triggerDownload(url, `ogp-${patternType}-${slug}.png`);
    },
    [patternType, slug, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, hslAdjust, compositeOverlay],
  );

  const exitOgpMode = useCallback(() => setOgpMode(false), []);

  const getOgpJson = useCallback(
    (rect: { x: number; y: number; width: number; height: number }): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const config = buildOgpConfig(rect, canvas, {
        slug,
        patternType,
        colorSchemeName: COLOR_SCHEMES[colorSchemeIndex].name,
        zoom,
        txVal,
        tyVal,
        useTranslate,
        displayParams,
        hslAdjust,
      });
      return serializeOgpConfig(config);
    },
    [slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, useTranslate, displayParams, hslAdjust],
  );

  const handleOgpDownloadJson = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const json = getOgpJson(rect);
      if (!json) return;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `ogp-config-${patternType}-${slug}.json`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [getOgpJson, patternType, slug],
  );

  const handleOgpCopyJson = useCallback(
    async (rect: { x: number; y: number; width: number; height: number }) => {
      const json = getOgpJson(rect);
      if (!json) return;
      await navigator.clipboard.writeText(json);
    },
    [getOgpJson],
  );

  const handleEnterOgpEdit = useCallback(
    async (rect: { x: number; y: number; width: number; height: number }, aspectConfig: AspectConfig) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const outSize = getOutputDimensions(aspectConfig);

      const config = buildOgpConfig(rect, canvas, {
        slug,
        patternType,
        colorSchemeName: COLOR_SCHEMES[colorSchemeIndex].name,
        zoom,
        txVal,
        tyVal,
        useTranslate,
        displayParams,
        hslAdjust,
      });
      const { srcX, srcY, srcW, srcH } = viewportRectToBufferRect(rect, canvas);
      const bufW = canvas.width;
      const bufH = canvas.height;
      const cropX = srcX / bufW;
      const cropY = srcY / bufH;
      const cropW = srcW / bufW;
      const cropH = srcH / bufH;

      const renderSize = Math.min(4000, Math.max(
        CANVAS_SIZE,
        Math.ceil(outSize.width / cropW),
        Math.ceil(outSize.height / cropH),
      ));

      const hiResCanvas = document.createElement('canvas');
      hiResCanvas.width = renderSize;
      hiResCanvas.height = renderSize;
      generateOnCanvas(hiResCanvas, slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate);

      const hiResCtx = hiResCanvas.getContext('2d');
      if (!hiResCtx) return;
      if (hslAdjust.h !== 0 || hslAdjust.s !== 0 || hslAdjust.l !== 0) {
        applyHslAdjust(hiResCtx, renderSize, renderSize, hslAdjust);
      }

      // Composite image overlay if present
      compositeOverlay(hiResCtx, renderSize, renderSize);

      const cx = Math.round(cropX * renderSize);
      const cy = Math.round(cropY * renderSize);
      const cw = Math.min(Math.round(cropW * renderSize), renderSize - cx);
      const ch = Math.min(Math.round(cropH * renderSize), renderSize - cy);

      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = outSize.width;
      bgCanvas.height = outSize.height;
      const bgCtx = bgCanvas.getContext('2d');
      if (!bgCtx) return;
      bgCtx.drawImage(hiResCanvas, cx, cy, cw, ch, 0, 0, outSize.width, outSize.height);

      const bitmap = await createImageBitmap(bgCanvas);
      setEditorBgImage(bitmap);
      setEditorBgConfig(config);
      setEditorOutputSize(outSize);
      setOgpEditMode(true);
    },
    [slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, hslAdjust, displayParams, compositeOverlay],
  );

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

      {ogpMode && !ogpEditMode && (
        <OgpSelectionOverlay
          onGenerate={handleOgpGenerate}
          onExit={exitOgpMode}
          onDownloadJson={handleOgpDownloadJson}
          onCopyJson={handleOgpCopyJson}
          onEdit={handleEnterOgpEdit}
        />
      )}

      {ogpEditMode && (
        <OgpEditor
          backgroundImage={editorBgImage}
          backgroundConfig={editorBgConfig}
          outputWidth={editorOutputSize.width}
          outputHeight={editorOutputSize.height}
          onExit={() => setOgpEditMode(false)}
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

        <ImageOverlayPanel
          hasImage={!!importedImage}
          isProcessing={isProcessing}
          processingProgress={processingProgress}
          bgThreshold={bgThreshold}
          overlayOpacity={overlayOpacity}
          error={importError}
          onImport={handleImageImport}
          onClear={handleImageClear}
          onThresholdChange={setBgThreshold}
          onOpacityChange={setOverlayOpacity}
        />

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
