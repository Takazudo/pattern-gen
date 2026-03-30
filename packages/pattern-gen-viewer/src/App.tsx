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
import { SelectionOverlay, getOutputDimensions } from './components/selection-overlay.js';
import type { AspectConfig } from './components/selection-overlay.js';
import { Composer } from './components/composer.js';
import { ImageOverlayPanel } from './components/image-overlay-panel.js';
import { ImageOverlayTransform } from './components/image-overlay-transform.js';
import type { ImageTransform } from './components/image-overlay-transform.js';
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

/** Get the scale/offset info for mapping viewport → canvas buffer (object-fit: cover). */
function getCanvasScaleInfo(canvas: HTMLCanvasElement) {
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
  return { canvasRect, bufW, bufH, offsetX, offsetY, scale };
}

/** Map a viewport rect to canvas buffer coordinates, accounting for object-fit: cover. */
function viewportRectToBufferRect(
  viewportRect: { x: number; y: number; width: number; height: number },
  canvas: HTMLCanvasElement,
): { srcX: number; srcY: number; srcW: number; srcH: number } {
  const { canvasRect, bufW, bufH, offsetX, offsetY, scale } = getCanvasScaleInfo(canvas);
  const srcX = Math.max(0, (viewportRect.x - canvasRect.left - offsetX) * scale);
  const srcY = Math.max(0, (viewportRect.y - canvasRect.top - offsetY) * scale);
  const srcW = Math.min(viewportRect.width * scale, bufW - srcX);
  const srcH = Math.min(viewportRect.height * scale, bufH - srcY);
  return { srcX, srcY, srcW, srcH };
}

/** Convert viewport CSS coordinates to canvas buffer coordinates (unclamped). */
function viewportToBufferCoords(
  vpRect: { x: number; y: number; width: number; height: number },
  canvas: HTMLCanvasElement,
): { x: number; y: number; width: number; height: number } {
  const { canvasRect, offsetX, offsetY, scale } = getCanvasScaleInfo(canvas);
  return {
    x: (vpRect.x - canvasRect.left - offsetX) * scale,
    y: (vpRect.y - canvasRect.top - offsetY) * scale,
    width: vpRect.width * scale,
    height: vpRect.height * scale,
  };
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
  const [composerMode, setComposerMode] = useState(false);
  const [composerBgImage, setComposerBgImage] = useState<ImageBitmap | null>(null);
  const [composerBgConfig, setComposerBgConfig] = useState<OgpConfig | null>(null);
  const [composerOutputSize, setComposerOutputSize] = useState({ width: OGP_WIDTH, height: OGP_HEIGHT });
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
  const [imageTransform, setImageTransform] = useState<ImageTransform | null>(null);
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cachedImageDataRef = useRef<ImageData | null>(null);
  const hslAdjustedRef = useRef<ImageData | null>(null);
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

  // Apply HSL adjustment from cached ImageData and cache the result
  const applyHslAndCache = useCallback(() => {
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
    hslAdjustedRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [hslAdjust]);

  // Restore HSL-adjusted canvas from cache (fast putImageData, no per-pixel HSL)
  const restoreHslAdjusted = useCallback(() => {
    const canvas = canvasRef.current;
    const data = hslAdjustedRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(data, 0, 0);
  }, []);

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

  // Auto-fit image transform on import
  useEffect(() => {
    if (!importedImage) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const imgAspect = importedImage.width / importedImage.height;
    const maxW = vw * 0.8;
    const maxH = vh * 0.8;
    let w: number;
    let h: number;
    if (maxW / maxH > imgAspect) {
      h = maxH;
      w = h * imgAspect;
    } else {
      w = maxW;
      h = w / imgAspect;
    }
    setImageTransform({
      x: (vw - w) / 2,
      y: (vh - h) / 2,
      width: w,
      height: h,
    });
  }, [importedImage]);

  // Cache HSL-adjusted pattern when pattern or HSL params change
  useEffect(() => {
    applyHslAndCache();
  }, [applyHslAndCache, generateAndCache]);

  // Composite rendering: restore HSL-adjusted pattern + optional image overlay.
  // This runs on overlay-only changes (transform, opacity, threshold) without
  // re-running the expensive HSL per-pixel loop.
  useEffect(() => {
    restoreHslAdjusted();

    // Composite image overlay on top if present
    const thresholded = thresholdedRef.current;
    if (!importedImage || !thresholded || !imageTransform) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tempCanvas = new OffscreenCanvas(thresholded.width, thresholded.height);
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.putImageData(thresholded, 0, 0);

    // Convert viewport transform to canvas buffer coordinates
    const buf = viewportToBufferCoords(imageTransform, canvas);

    ctx.save();
    ctx.globalAlpha = overlayOpacity / 100;
    ctx.drawImage(tempCanvas, buf.x, buf.y, buf.width, buf.height);
    ctx.restore();
  }, [restoreHslAdjusted, applyHslAndCache, importedImage, bgThreshold, overlayOpacity, imageTransform]);

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
    setImageTransform(null);
    setKeepAspectRatio(true);
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
    setImageTransform(null);
    setKeepAspectRatio(true);
    setBgThreshold(0);
    setOverlayOpacity(100);
    setImportError(null);
  }, []);

  const handleKeepAspectRatioChange = useCallback((keep: boolean) => {
    setKeepAspectRatio(keep);
    if (keep && importedImage) {
      const aspect = importedImage.width / importedImage.height;
      setImageTransform((prev) => {
        if (!prev) return prev;
        const cx = prev.x + prev.width / 2;
        const cy = prev.y + prev.height / 2;
        const w = prev.width;
        const h = w / aspect;
        return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
      });
    }
  }, [importedImage]);

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

    let drawX: number;
    let drawY: number;
    let drawW: number;
    let drawH: number;

    if (imageTransform && canvasRef.current) {
      // Map viewport transform → main buffer → target canvas
      const mainCanvas = canvasRef.current;
      const buf = viewportToBufferCoords(imageTransform, mainCanvas);
      const scaleFactor = canvasW / mainCanvas.width;
      drawX = buf.x * scaleFactor;
      drawY = buf.y * scaleFactor;
      drawW = buf.width * scaleFactor;
      drawH = buf.height * scaleFactor;
    } else {
      // Fallback: contain-fit
      const scale = Math.min(canvasW / thresholded.width, canvasH / thresholded.height);
      drawW = thresholded.width * scale;
      drawH = thresholded.height * scale;
      drawX = (canvasW - drawW) / 2;
      drawY = (canvasH - drawH) / 2;
    }

    ctx.save();
    ctx.globalAlpha = overlayOpacity / 100;
    ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [importedImage, overlayOpacity, imageTransform]);

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

  const handleEnterComposer = useCallback(
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
      setComposerBgImage(bitmap);
      setComposerBgConfig(config);
      setComposerOutputSize(outSize);
      setComposerMode(true);
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

      {!ogpMode && importedImage && imageTransform && (
        <ImageOverlayTransform
          transform={imageTransform}
          onChange={setImageTransform}
          keepAspectRatio={keepAspectRatio}
          onKeepAspectRatioChange={handleKeepAspectRatioChange}
          imageAspect={importedImage.width / importedImage.height}
        />
      )}

      {ogpMode && !composerMode && (
        <SelectionOverlay
          onGenerate={handleOgpGenerate}
          onExit={exitOgpMode}
          onDownloadJson={handleOgpDownloadJson}
          onCopyJson={handleOgpCopyJson}
          onEdit={handleEnterComposer}
        />
      )}

      {composerMode && (
        <Composer
          backgroundImage={composerBgImage}
          backgroundConfig={composerBgConfig}
          outputWidth={composerOutputSize.width}
          outputHeight={composerOutputSize.height}
          onExit={() => setComposerMode(false)}
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

        <button className="btn btn-compose-mode" onClick={() => setOgpMode(true)}>
          OGP Mode
        </button>

        <ImageOverlayPanel
          hasImage={!!importedImage}
          isProcessing={isProcessing}
          processingProgress={processingProgress}
          bgThreshold={bgThreshold}
          overlayOpacity={overlayOpacity}
          keepAspectRatio={keepAspectRatio}
          error={importError}
          onImport={handleImageImport}
          onClear={handleImageClear}
          onThresholdChange={setBgThreshold}
          onOpacityChange={setOverlayOpacity}
          onKeepAspectRatioChange={handleKeepAspectRatioChange}
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
