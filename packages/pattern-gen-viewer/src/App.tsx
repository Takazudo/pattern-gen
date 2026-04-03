import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  hashString,
  createRandom,
  COLOR_SCHEMES,
  applyHslAdjust,
  getEffectiveParams,
  centerDetentToZoom,
  zoomToCenterDetent,
  serializeOgpConfig,
  OGP_WIDTH,
  OGP_HEIGHT,
} from '@takazudo/pattern-gen-core';
import type { PatternOptions, ParamDef, OgpConfig } from '@takazudo/pattern-gen-core';
import { patternRegistry, patternsByName } from '@takazudo/pattern-gen-generators';
import { ParamControls } from './components/param-controls.js';
import { ColorTweakPanel } from './components/color-tweak-panel.js';
import { applyContrastBrightness } from './utils/apply-contrast-brightness.js';
import { ViewTransformPanel } from './components/view-transform-panel.js';
import { SelectionOverlay, getOutputDimensions } from './components/selection-overlay.js';
import type { AspectConfig } from './components/selection-overlay.js';
import { Composer } from './components/composer.js';
import { ImageLayerPanel } from './components/image-layer-panel.js';
import { ImageOverlayTransform } from './components/image-overlay-transform.js';
import type { ImageTransform } from './components/image-overlay-transform.js';
import type { ViewerImageLayer } from './types/viewer-image-layer.js';
import { CollapsibleSection } from './components/collapsible-section.js';
import { StepIndicator } from './components/step-indicator.js';
import type { AppStep } from './components/step-indicator.js';
import { removeBackgroundViaWorker, applyThreshold } from '@takazudo/pattern-gen-image-processor';
import type { ProcessedImage } from '@takazudo/pattern-gen-image-processor';
import { downloadBlob, triggerDownload } from './utils/trigger-download.js';
import { useAuth } from './contexts/auth-context.js';
import { AuthButton } from './components/auth-button.js';
import { SavePatternModal } from './components/save-pattern-modal.js';
import { MyPatterns } from './components/my-patterns.js';
import { MyFiles } from './components/my-files.js';
import { ImageUpload } from './components/image-upload.js';

const CANVAS_SIZE = 1200;
const DPR = window.devicePixelRatio || 1;

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

function buildBackgroundConfig(
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
    rotate: number;
    skewX: number;
    skewY: number;
    displayParams: Record<string, number>;
    hslAdjust: { h: number; s: number; l: number };
    contrastBrightness: { contrast: number; brightness: number };
  },
): OgpConfig {
  const { srcX, srcY, srcW, srcH } = viewportRectToBufferRect(viewportRect, canvas);
  const bufW = canvas.width;
  const bufH = canvas.height;

  const cb = state.contrastBrightness;
  const hasContrastBrightness = cb.contrast !== 0 || cb.brightness !== 0;

  return {
    version: 1,
    slug: state.slug,
    type: state.patternType,
    colorScheme: state.colorSchemeName,
    zoom: state.zoom,
    translateX: state.txVal,
    translateY: state.tyVal,
    useTranslate: state.useTranslate,
    ...(state.rotate !== 0 ? { rotate: state.rotate } : {}),
    ...(state.skewX !== 0 ? { skewX: state.skewX } : {}),
    ...(state.skewY !== 0 ? { skewY: state.skewY } : {}),
    params: { ...state.displayParams },
    hsl: { ...state.hslAdjust },
    ...(hasContrastBrightness ? { contrastBrightness: { ...cb } } : {}),
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
  rotate: number,
  skewX: number,
  skewY: number,
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

  const hasTransforms = rotate !== 0 || skewX !== 0 || skewY !== 0 ||
    translateX !== 0 || translateY !== 0;

  if (useTranslate) {
    // Render pattern on a larger offscreen canvas so panning reveals
    // continuous content at any translate position (±100% range).
    // iOS Safari silently fails when total canvas pixels exceed device
    // memory limits (~16.7M). Desktop browsers handle 100M+ fine.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const MAX_CANVAS_PIXELS = isIOS ? 16_777_216 : Number.MAX_SAFE_INTEGER;
    let scale = 3;
    while (scale > 1) {
      const totalPixels = (canvas.width * scale) * (canvas.height * scale);
      if (totalPixels <= MAX_CANVAS_PIXELS) break;
      scale--;
    }

    // scale is at least 1 — at scale=1 the offscreen is same-size as
    // the main canvas; translate may show edges but rotate/skew still work.
    const ow = canvas.width * scale;
    const oh = canvas.height * scale;
    const offscreen = new OffscreenCanvas(ow, oh);
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) {
      // Last-resort fallback: render directly (no transforms)
      pattern.generate(ctx, options);
      return;
    }
    pattern.generate(offCtx as unknown as CanvasRenderingContext2D, {
      ...options,
      width: ow,
      height: oh,
      zoom: zoom * scale,
    });

    // Center the oversized canvas, then apply translate offset
    const tx = translateX * canvas.width;
    const ty = translateY * canvas.height;
    const baseOffset = -canvas.width * (scale - 1) / 2; // center: -(scale-1)/2 * size
    ctx.save();

    // Apply transforms from center of canvas
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);

    // Apply skew via transform matrix
    if (skewX !== 0 || skewY !== 0) {
      const tanX = Math.tan((skewX * Math.PI) / 180);
      const tanY = Math.tan((skewY * Math.PI) / 180);
      ctx.transform(1, tanY, tanX, 1, 0, 0);
    }

    ctx.translate(-cx, -cy);
    ctx.translate(baseOffset + tx, baseOffset + ty);
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();
  } else if (hasTransforms) {
    // No big canvas — apply transforms directly to the main canvas.
    // Black edges may appear at extreme values (no extra canvas buffer).
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);
    if (skewX !== 0 || skewY !== 0) {
      const tanX = Math.tan((skewX * Math.PI) / 180);
      const tanY = Math.tan((skewY * Math.PI) / 180);
      ctx.transform(1, tanY, tanX, 1, 0, 0);
    }
    ctx.translate(-cx, -cy);
    ctx.translate(translateX * canvas.width, translateY * canvas.height);
    pattern.generate(ctx, options);
    ctx.restore();
  } else {
    // Direct render — no transforms, fastest path
    pattern.generate(ctx, options);
  }
}

/** Compute thresholded image data for a layer (pure function, no closure deps). */
function computeThresholdedCache(layer: ViewerImageLayer): ImageData | null {
  if (!layer.processed) return null;
  return layer.bgRemovalEnabled
    ? applyThreshold(layer.processed, { threshold: layer.bgThreshold })
    : layer.processed.original;
}

export function App() {
  const [slug, setSlug] = useState(randomSlug);
  const [patternType, setPatternType] = useState(patternRegistry[0].name);
  const [colorSchemeIndex, setColorSchemeIndex] = useState(0);
  const [zoomSlider, setZoomSlider] = useState(50);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [useTranslate, setUseTranslate] = useState(false);
  const [rotate, setRotate] = useState(0);
  const [skewX, setSkewX] = useState(0);
  const [skewY, setSkewY] = useState(0);
  const [currentStep, setCurrentStep] = useState<AppStep>('background');
  const [composerActive, setComposerActive] = useState(false);
  const [composerBgImage, setComposerBgImage] = useState<ImageBitmap | null>(null);
  const [composerBgConfig, setComposerBgConfig] = useState<OgpConfig | null>(null);
  const [composerOutputSize, setComposerOutputSize] = useState({ width: OGP_WIDTH, height: OGP_HEIGHT });
  // Only tracks params the user explicitly changed via UI controls
  const [userOverrides, setUserOverrides] = useState<Record<string, number>>({});
  // Params locked to their current value across seed changes
  const [fixedParams, setFixedParams] = useState<Set<string>>(new Set());
  const fixedParamsRef = useRef(fixedParams);
  fixedParamsRef.current = fixedParams;
  const [hslAdjust, setHslAdjust] = useState({ h: 0, s: 0, l: 0 });
  const [fixedColorScheme, setFixedColorScheme] = useState(false);
  const [fixedViewTransform, setFixedViewTransform] = useState(false);
  const fixedViewTransformRef = useRef(fixedViewTransform);
  fixedViewTransformRef.current = fixedViewTransform;
  const [contrastBrightness, setContrastBrightness] = useState({ contrast: 0, brightness: 0 });
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);
  // Auth-related UI state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalData, setSaveModalData] = useState<{ configJson: string; previewDataUrl?: string } | null>(null);
  const [showMyPatterns, setShowMyPatterns] = useState(false);
  const [showMyFiles, setShowMyFiles] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const skipResetRef = useRef(0);
  // Image layers state (multi-image)
  const [imageLayers, setImageLayers] = useState<ViewerImageLayer[]>([]);
  const imageLayersRef = useRef(imageLayers);
  imageLayersRef.current = imageLayers;
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cachedImageDataRef = useRef<ImageData | null>(null);
  const hslAdjustedRef = useRef<ImageData | null>(null);
  const colorAdjustedRef = useRef<ImageData | null>(null);

  // Derived: selected layer
  const selectedLayer = useMemo(
    () => imageLayers.find((l) => l.id === selectedLayerId) ?? null,
    [imageLayers, selectedLayerId],
  );

  // Any layer currently processing?
  const anyProcessing = imageLayers.some((l) => l.isProcessing);

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

  // Read URL params on mount — reproduce pattern from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('slug')) return; // No URL params, use defaults

    const urlSlug = params.get('slug');
    const urlType = params.get('type');
    const urlColor = params.get('color');

    // Count how many dep changes will trigger the reset effect.
    // Each of slug/patternType that differs from initial state will fire the effect.
    let skipCount = 0;
    if (urlSlug) skipCount++;
    if (urlType) skipCount++;
    if (skipCount > 0) skipResetRef.current = skipCount;

    if (urlSlug) setSlug(urlSlug);
    if (urlType) setPatternType(urlType);
    if (urlColor) setColorSchemeIndex(Number(urlColor));

    if (params.has('zoom')) setZoomSlider(Number(params.get('zoom')));
    if (params.get('translate') === '1') {
      setUseTranslate(true);
      if (params.has('tx')) setTranslateX(Number(params.get('tx')));
      if (params.has('ty')) setTranslateY(Number(params.get('ty')));
    }
    if (params.has('rotate')) setRotate(Number(params.get('rotate')));
    if (params.has('skewX')) setSkewX(Number(params.get('skewX')));
    if (params.has('skewY')) setSkewY(Number(params.get('skewY')));

    // Restore user overrides (p_* params)
    const overrides: Record<string, number> = {};
    for (const [key, val] of params.entries()) {
      if (key.startsWith('p_')) {
        overrides[key.slice(2)] = Number(val);
      }
    }
    if (Object.keys(overrides).length > 0) setUserOverrides(overrides);

    // HSL
    if (params.has('hsl_h') || params.has('hsl_s') || params.has('hsl_l')) {
      setHslAdjust({
        h: Number(params.get('hsl_h') || 0),
        s: Number(params.get('hsl_s') || 0),
        l: Number(params.get('hsl_l') || 0),
      });
    }

    // Contrast/brightness
    if (params.has('contrast') || params.has('brightness')) {
      setContrastBrightness({
        contrast: Number(params.get('contrast') || 0),
        brightness: Number(params.get('brightness') || 0),
      });
    }
  }, []); // Run once on mount

  // Reset non-fixed user overrides and transform when pattern type or slug changes
  useEffect(() => {
    // Skip reset when restoring state from URL params
    if (skipResetRef.current > 0) {
      skipResetRef.current--;
      return;
    }
    setUserOverrides((prev) => {
      const kept: Record<string, number> = {};
      for (const key of fixedParamsRef.current) {
        if (key in prev) kept[key] = prev[key];
      }
      return kept;
    });
    if (!fixedViewTransformRef.current) {
      setZoomSlider(50);
      setTranslateX(0);
      setTranslateY(0);
      setUseTranslate(false);
      setRotate(0);
      setSkewX(0);
      setSkewY(0);
    }
  }, [patternType, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate pattern (without HSL) and cache the result
  const generateAndCache = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    generateOnCanvas(canvas, slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, rotate, skewX, skewY);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      cachedImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }, [slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, rotate, skewX, skewY]);

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

  // Apply contrast/brightness from HSL-adjusted cache and cache the result
  const applyContrastBrightnessAndCache = useCallback(() => {
    const canvas = canvasRef.current;
    const hslData = hslAdjustedRef.current;
    if (!canvas || !hslData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(hslData, 0, 0);
    applyContrastBrightness(ctx, canvas.width, canvas.height, contrastBrightness);
    colorAdjustedRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [contrastBrightness]);

  // Restore color-adjusted canvas from cache (fast putImageData)
  const restoreColorAdjusted = useCallback(() => {
    const canvas = canvasRef.current;
    const data = colorAdjustedRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(data, 0, 0);
  }, []);

  // Re-generate pattern when pattern params change
  useEffect(() => {
    generateAndCache();
  }, [generateAndCache]);

  // Cache HSL-adjusted pattern when pattern or HSL params change
  useEffect(() => {
    applyHslAndCache();
  }, [applyHslAndCache, generateAndCache]);

  // Cache contrast/brightness-adjusted pattern
  useEffect(() => {
    applyContrastBrightnessAndCache();
  }, [applyContrastBrightnessAndCache, applyHslAndCache, generateAndCache]);

  // Composite rendering: restore color-adjusted pattern + optional image overlay.
  // This runs on overlay-only changes (transform, opacity, threshold) without
  // re-running the expensive per-pixel loops.
  useEffect(() => {
    restoreColorAdjusted();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw layers bottom-to-top (last in array = back, first = front)
    for (const layer of [...imageLayers].reverse()) {
      if (!layer.processed || !layer.transform) continue;
      const thresholded = layer.thresholdedCache;
      if (!thresholded) continue;

      const tempCanvas = new OffscreenCanvas(thresholded.width, thresholded.height);
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) continue;
      tempCtx.putImageData(thresholded, 0, 0);

      const buf = viewportToBufferCoords(layer.transform, canvas);

      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;
      ctx.drawImage(tempCanvas, buf.x, buf.y, buf.width, buf.height);
      ctx.restore();
    }
  }, [restoreColorAdjusted, applyContrastBrightnessAndCache, applyHslAndCache, generateAndCache, imageLayers]);

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

  const handleContrastBrightnessChange = useCallback((contrast: number, brightness: number) => {
    setContrastBrightness({ contrast, brightness });
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
      setRotate(0);
      setSkewX(0);
      setSkewY(0);
    }
  }, []);

  const handleRotateChange = useCallback((degrees: number) => {
    setRotate(degrees);
  }, []);

  const handleSkewChange = useCallback((sx: number, sy: number) => {
    setSkewX(sx);
    setSkewY(sy);
  }, []);

  const handleGenerateUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('slug', slug);
    params.set('type', patternType);
    params.set('color', String(colorSchemeIndex));

    // Only include non-default values
    if (zoomSlider !== 50) params.set('zoom', String(zoomSlider));
    if (useTranslate) params.set('translate', '1');
    if (translateX !== 0) params.set('tx', String(translateX));
    if (translateY !== 0) params.set('ty', String(translateY));
    if (rotate !== 0) params.set('rotate', String(rotate));
    if (skewX !== 0) params.set('skewX', String(skewX));
    if (skewY !== 0) params.set('skewY', String(skewY));

    // Include user-overridden params
    for (const [key, val] of Object.entries(userOverrides)) {
      params.set(`p_${key}`, String(val));
    }

    // HSL adjustments
    if (hslAdjust.h !== 0) params.set('hsl_h', String(hslAdjust.h));
    if (hslAdjust.s !== 0) params.set('hsl_s', String(hslAdjust.s));
    if (hslAdjust.l !== 0) params.set('hsl_l', String(hslAdjust.l));

    // Contrast/brightness
    if (contrastBrightness.contrast !== 0) params.set('contrast', String(contrastBrightness.contrast));
    if (contrastBrightness.brightness !== 0) params.set('brightness', String(contrastBrightness.brightness));

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    setGeneratedUrl(url);
    setShowUrlModal(true);
  }, [slug, patternType, colorSchemeIndex, zoomSlider, useTranslate, translateX, translateY, rotate, skewX, skewY, userOverrides, hslAdjust, contrastBrightness]);

  // Layer counter for unique naming
  const layerCounterRef = useRef(0);

  const handleImageImport = useCallback(async (file: File) => {
    let img: ImageBitmap;
    try {
      img = await createImageBitmap(file);
    } catch {
      alert(`Failed to decode image file: ${file.name}`);
      return;
    }

    layerCounterRef.current += 1;
    const newId = crypto.randomUUID();
    const name = `Image ${layerCounterRef.current}`;
    const rawCanvas = new OffscreenCanvas(img.width, img.height);
    const rawCtx = rawCanvas.getContext('2d');
    if (!rawCtx) return;
    rawCtx.drawImage(img, 0, 0);
    const imageData = rawCtx.getImageData(0, 0, img.width, img.height);

    // Create ProcessedImage with fully opaque alpha mask (no bg removal yet)
    const processed: ProcessedImage = {
      original: imageData,
      alphaMask: new Uint8ClampedArray(img.width * img.height).fill(255),
      width: img.width,
      height: img.height,
    };

    // Auto-fit transform
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const imgAspect = img.width / img.height;
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
    const transform: ImageTransform = {
      x: (vw - w) / 2,
      y: (vh - h) / 2,
      width: w,
      height: h,
    };

    const newLayer: ViewerImageLayer = {
      id: newId,
      name,
      processed,
      originalFile: file,
      opacity: 100,
      bgThreshold: 0,
      bgRemovalEnabled: false,
      hasBgRemovalData: false,
      transform,
      keepAspectRatio: true,
      isProcessing: false,
      processingProgress: 0,
      error: null,
      thresholdedCache: null,
    };
    newLayer.thresholdedCache = computeThresholdedCache(newLayer);

    setImageLayers((prev) => [newLayer, ...prev]);
    setSelectedLayerId(newId);
  }, []);

  const handleDeleteLayer = useCallback((id: string) => {
    setImageLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedLayerId((prev) => (prev === id ? null : prev));
  }, []);

  const handleDuplicateImageLayer = useCallback((id: string) => {
    const newId = crypto.randomUUID();
    setImageLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const source = prev[idx];
      const clone: ViewerImageLayer = {
        ...source,
        id: newId,
        name: `${source.name} copy`,
        transform: source.transform
          ? { ...source.transform, x: source.transform.x + 20, y: source.transform.y + 20 }
          : null,
        thresholdedCache: source.thresholdedCache ?? null,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setSelectedLayerId(newId);
  }, []);

  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    setImageLayers((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleLayerOpacityChange = useCallback((id: string, value: number) => {
    setImageLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity: value } : l)),
    );
  }, []);

  const handleLayerThresholdChange = useCallback((id: string, value: number) => {
    setImageLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, bgThreshold: value };
        updated.thresholdedCache = computeThresholdedCache(updated);
        return updated;
      }),
    );
  }, []);

  const handleLayerBgRemovalToggle = useCallback(async (id: string, enabled: boolean) => {
    if (!enabled) {
      // Turning off bg removal — just toggle the flag
      setImageLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const updated = { ...l, bgRemovalEnabled: false };
          updated.thresholdedCache = computeThresholdedCache(updated);
          return updated;
        }),
      );
      return;
    }

    // Enabling bg removal — check if ML data already exists
    const layer = imageLayersRef.current.find((l) => l.id === id);
    if (!layer) return;

    if (layer.hasBgRemovalData) {
      // Already has ML data, just enable
      setImageLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const updated = { ...l, bgRemovalEnabled: true };
          updated.thresholdedCache = computeThresholdedCache(updated);
          return updated;
        }),
      );
      return;
    }

    // Run ML bg removal for the first time
    if (!layer.originalFile) return;
    setImageLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isProcessing: true, processingProgress: 0, error: null } : l)),
    );

    try {
      const processed = await removeBackgroundViaWorker(layer.originalFile, {
        onProgress: (p: number) => {
          setImageLayers((prev) =>
            prev.map((l) =>
              l.id === id ? { ...l, processingProgress: Math.round(p * 100) } : l,
            ),
          );
        },
      });

      setImageLayers((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const updated = { ...l, processed, hasBgRemovalData: true, bgRemovalEnabled: true, isProcessing: false, processingProgress: 100 };
          updated.thresholdedCache = computeThresholdedCache(updated);
          return updated;
        }),
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Background removal failed';
      setImageLayers((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, error: errMsg, isProcessing: false } : l,
        ),
      );
    }
  }, []);

  const handleLayerKeepAspectRatioChange = useCallback((id: string, keep: boolean) => {
    setImageLayers((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (keep && l.processed && l.transform) {
          const aspect = l.processed.width / l.processed.height;
          const cx = l.transform.x + l.transform.width / 2;
          const cy = l.transform.y + l.transform.height / 2;
          const w = l.transform.width;
          const h = w / aspect;
          return { ...l, keepAspectRatio: true, transform: { x: cx - w / 2, y: cy - h / 2, width: w, height: h } };
        }
        return { ...l, keepAspectRatio: keep };
      }),
    );
  }, []);

  const handleLayerTransformChange = useCallback((id: string, transform: ImageTransform) => {
    setImageLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, transform } : l)),
    );
  }, []);

  // Randomize changes slug (seed) and color scheme
  const randomize = useCallback(() => {
    setSlug(randomSlug());
    if (!fixedColorScheme) {
      setColorSchemeIndex(Math.floor(Math.random() * COLOR_SCHEMES.length));
    }
  }, [fixedColorScheme]);

  // Downloads at the full buffer resolution (CANVAS_SIZE * dpr).
  // To get a fixed 1200×1200 PNG regardless of dpr, draw onto a temporary
  // 1200×1200 canvas before calling toDataURL.
  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    triggerDownload(url, `pattern-${patternType}-${slug}.png`);
  }, [patternType, slug]);

  // Composite all image overlay layers onto a canvas (used by export paths)
  const compositeOverlay = useCallback((ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
    // Draw layers bottom-to-top (last in array = back, first = front)
    for (const layer of [...imageLayers].reverse()) {
      if (!layer.processed || !layer.thresholdedCache) continue;

      const thresholded = layer.thresholdedCache;
      const tempCanvas = new OffscreenCanvas(thresholded.width, thresholded.height);
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) continue;
      tempCtx.putImageData(thresholded, 0, 0);

      let drawX: number;
      let drawY: number;
      let drawW: number;
      let drawH: number;

      if (layer.transform && canvasRef.current) {
        const mainCanvas = canvasRef.current;
        const buf = viewportToBufferCoords(layer.transform, mainCanvas);
        const scaleFactor = canvasW / mainCanvas.width;
        drawX = buf.x * scaleFactor;
        drawY = buf.y * scaleFactor;
        drawW = buf.width * scaleFactor;
        drawH = buf.height * scaleFactor;
      } else {
        const scale = Math.min(canvasW / thresholded.width, canvasH / thresholded.height);
        drawW = thresholded.width * scale;
        drawH = thresholded.height * scale;
        drawX = (canvasW - drawW) / 2;
        drawY = (canvasH - drawH) / 2;
      }

      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;
      ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
      ctx.restore();
    }
  }, [imageLayers]);

  const handleSelectionGenerate = useCallback(
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
      generateOnCanvas(hiResCanvas, slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, rotate, skewX, skewY);

      // Apply HSL adjustments
      const hiResCtx = hiResCanvas.getContext('2d');
      if (!hiResCtx) return;
      if (hslAdjust.h !== 0 || hslAdjust.s !== 0 || hslAdjust.l !== 0) {
        applyHslAdjust(hiResCtx, renderSize, renderSize, hslAdjust);
      }

      // Apply contrast/brightness adjustments
      applyContrastBrightness(hiResCtx, renderSize, renderSize, contrastBrightness);

      // Composite image overlay if present
      compositeOverlay(hiResCtx, renderSize, renderSize);

      // Crop and scale to output dimensions
      const cx = Math.round(cropX * renderSize);
      const cy = Math.round(cropY * renderSize);
      const cw = Math.min(Math.round(cropW * renderSize), renderSize - cx);
      const ch = Math.min(Math.round(cropH * renderSize), renderSize - cy);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = OGP_WIDTH;
      outCanvas.height = OGP_HEIGHT;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return;
      outCtx.drawImage(hiResCanvas, cx, cy, cw, ch, 0, 0, OGP_WIDTH, OGP_HEIGHT);

      const url = outCanvas.toDataURL('image/png');
      triggerDownload(url, `crop-${patternType}-${slug}.png`);
    },
    [patternType, slug, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, rotate, skewX, skewY, hslAdjust, contrastBrightness, compositeOverlay],
  );

  const getConfigJson = useCallback(
    (rect: { x: number; y: number; width: number; height: number }): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const config = buildBackgroundConfig(rect, canvas, {
        slug,
        patternType,
        colorSchemeName: COLOR_SCHEMES[colorSchemeIndex].name,
        zoom,
        txVal,
        tyVal,
        useTranslate,
        rotate,
        skewX,
        skewY,
        displayParams,
        hslAdjust,
        contrastBrightness,
      });
      return serializeOgpConfig(config);
    },
    [slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, useTranslate, rotate, skewX, skewY, displayParams, hslAdjust, contrastBrightness],
  );

  const handleDownloadJson = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const json = getConfigJson(rect);
      if (!json) return;
      const blob = new Blob([json], { type: 'application/json' });
      downloadBlob(blob, `config-${patternType}-${slug}.json`);
    },
    [getConfigJson, patternType, slug],
  );

  const handleCopyJson = useCallback(
    async (rect: { x: number; y: number; width: number; height: number }) => {
      const json = getConfigJson(rect);
      if (!json) return;
      await navigator.clipboard.writeText(json);
    },
    [getConfigJson],
  );

  const handleEnterComposer = useCallback(
    async (rect: { x: number; y: number; width: number; height: number }, aspectConfig: AspectConfig) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const outSize = getOutputDimensions(aspectConfig);

      const config = buildBackgroundConfig(rect, canvas, {
        slug,
        patternType,
        colorSchemeName: COLOR_SCHEMES[colorSchemeIndex].name,
        zoom,
        txVal,
        tyVal,
        useTranslate,
        rotate,
        skewX,
        skewY,
        displayParams,
        hslAdjust,
        contrastBrightness,
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
      generateOnCanvas(hiResCanvas, slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, rotate, skewX, skewY);

      const hiResCtx = hiResCanvas.getContext('2d');
      if (!hiResCtx) return;
      if (hslAdjust.h !== 0 || hslAdjust.s !== 0 || hslAdjust.l !== 0) {
        applyHslAdjust(hiResCtx, renderSize, renderSize, hslAdjust);
      }

      // Apply contrast/brightness adjustments
      applyContrastBrightness(hiResCtx, renderSize, renderSize, contrastBrightness);

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
      setComposerActive(true);
    },
    [slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, userOverrides, useTranslate, rotate, skewX, skewY, hslAdjust, contrastBrightness, displayParams, compositeOverlay],
  );

  const currentPalette = COLOR_SCHEMES[colorSchemeIndex].palette;

  const { isAuthenticated } = useAuth();

  const handleStepChange = useCallback((step: AppStep) => {
    setCurrentStep(step);
    setComposerActive(false);
  }, []);

  const handleExitToBackground = useCallback(() => setCurrentStep('background'), []);
  const handleExitComposer = useCallback(() => setComposerActive(false), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const getSaveConfigJson = useCallback((): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '{}';
    const rect = canvas.getBoundingClientRect();
    const config = buildBackgroundConfig(
      { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      canvas,
      {
        slug,
        patternType,
        colorSchemeName: COLOR_SCHEMES[colorSchemeIndex].name,
        zoom,
        txVal,
        tyVal,
        useTranslate,
        rotate,
        skewX,
        skewY,
        displayParams,
        hslAdjust,
        contrastBrightness,
      },
    );
    return serializeOgpConfig(config);
  }, [slug, patternType, colorSchemeIndex, zoom, txVal, tyVal, useTranslate, rotate, skewX, skewY, displayParams, hslAdjust, contrastBrightness]);

  const getSavePreviewDataUrl = useCallback((): string | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const preview = document.createElement('canvas');
    preview.width = 300;
    preview.height = 300;
    const pCtx = preview.getContext('2d');
    if (!pCtx) return undefined;
    pCtx.drawImage(canvas, 0, 0, 300, 300);
    return preview.toDataURL('image/png');
  }, []);

  const handleSavePattern = useCallback(() => {
    setSaveModalData({
      configJson: getSaveConfigJson(),
      previewDataUrl: getSavePreviewDataUrl(),
    });
    setShowSaveModal(true);
  }, [getSaveConfigJson, getSavePreviewDataUrl]);

  const handleLoadPattern = useCallback((configJson: string, _patternType: string) => {
    try {
      const config = JSON.parse(configJson) as OgpConfig;
      if (config.slug) setSlug(config.slug);
      if (config.type) {
        // Find pattern type name
        setPatternType(config.type);
      }
      if (config.colorScheme) {
        const idx = COLOR_SCHEMES.findIndex((s) => s.name === config.colorScheme);
        if (idx >= 0) setColorSchemeIndex(idx);
      }
      if (config.zoom != null) {
        setZoomSlider(Math.round(zoomToCenterDetent(config.zoom)));
      }
      if (config.useTranslate) {
        setUseTranslate(true);
        // Config stores translateX/Y as -1..1 fractions; state uses -100..100
        if (config.translateX != null) setTranslateX(config.translateX * 100);
        if (config.translateY != null) setTranslateY(config.translateY * 100);
      }
      if (config.rotate) setRotate(config.rotate);
      if (config.skewX) setSkewX(config.skewX);
      if (config.skewY) setSkewY(config.skewY);
      if (config.params) setUserOverrides(config.params);
      if (config.hsl) setHslAdjust(config.hsl);
      if (config.contrastBrightness) setContrastBrightness(config.contrastBrightness);
      showToast('Pattern loaded');
    } catch {
      showToast('Failed to load pattern config');
    }
  }, [showToast]);

  const showStepIndicator = !composerActive;

  return (
    <div className="app">
      <div className="canvas-layer">
        <canvas ref={canvasRef} width={Math.round(CANVAS_SIZE * DPR)} height={Math.round(CANVAS_SIZE * DPR)} />
        {anyProcessing && (
          <div className="canvas-processing-overlay" aria-hidden="true">
            <div className="processing-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
        )}
      </div>

      {showStepIndicator && (
        <StepIndicator currentStep={currentStep} onStepChange={handleStepChange} />
      )}

      {currentStep === 'background' && (
        <>
          {/* Auth button (top-right, before site link) */}
          <AuthButton
            onOpenMyPatterns={() => setShowMyPatterns(true)}
            onOpenMyFiles={() => setShowMyFiles(true)}
          />

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

      {currentStep === 'background' && selectedLayer?.processed && selectedLayer?.transform && (
        <ImageOverlayTransform
          transform={selectedLayer.transform}
          onChange={(t) => handleLayerTransformChange(selectedLayer.id, t)}
          keepAspectRatio={selectedLayer.keepAspectRatio}
          onKeepAspectRatioChange={(keep) => handleLayerKeepAspectRatioChange(selectedLayer.id, keep)}
          imageAspect={selectedLayer.processed.width / selectedLayer.processed.height}
        />
      )}

      {currentStep === 'compose' && !composerActive && (
        <SelectionOverlay
          onGenerate={handleSelectionGenerate}
          onExit={handleExitToBackground}
          onDownloadJson={handleDownloadJson}
          onCopyJson={handleCopyJson}
          onEdit={handleEnterComposer}
        />
      )}

      {composerActive && (
        <Composer
          backgroundImage={composerBgImage}
          backgroundConfig={composerBgConfig}
          outputWidth={composerOutputSize.width}
          outputHeight={composerOutputSize.height}
          onExit={handleExitComposer}
        />
      )}

      {currentStep === 'background' && (
        <div className="controls">
          <h1>zudo-pattern-gen</h1>

          <CollapsibleSection title="Pattern Generation" defaultOpen={true}>
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
          </CollapsibleSection>

          <CollapsibleSection title="Pattern Tweak">
            <div className="control-group">
              <div className="param-label-row">
                <label htmlFor="scheme-select">Color Scheme</label>
                <label className="fix-toggle">
                  <input
                    type="checkbox"
                    checked={fixedColorScheme}
                    onChange={(e) => setFixedColorScheme(e.target.checked)}
                  />
                  Fix
                </label>
              </div>
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
            <ParamControls
              paramDefs={currentParamDefs}
              values={displayParams}
              fixedParams={fixedParams}
              onChange={handleParamChange}
              onFixToggle={handleFixToggle}
            />
            <ViewTransformPanel
              zoomSlider={zoomSlider}
              translateX={translateX}
              translateY={translateY}
              useTranslate={useTranslate}
              rotate={rotate}
              skewX={skewX}
              skewY={skewY}
              fixedViewTransform={fixedViewTransform}
              onChange={handleTransformChange}
              onUseTranslateChange={handleUseTranslateChange}
              onRotateChange={handleRotateChange}
              onSkewChange={handleSkewChange}
              onFixedViewTransformChange={setFixedViewTransform}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Image Addition">
            <ImageLayerPanel
              layers={imageLayers}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onImport={handleImageImport}
              onDeleteLayer={handleDeleteLayer}
              onDuplicateLayer={handleDuplicateImageLayer}
              onReorder={handleLayerReorder}
              onOpacityChange={handleLayerOpacityChange}
              onThresholdChange={handleLayerThresholdChange}
              onBgRemovalToggle={handleLayerBgRemovalToggle}
              onKeepAspectRatioChange={handleLayerKeepAspectRatioChange}
            />
            {selectedLayerId && (
              <ImageUpload
                file={imageLayers.find((l) => l.id === selectedLayerId)?.originalFile ?? null}
              />
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Color Tweak">
            <ColorTweakPanel
              hue={hslAdjust.h}
              saturation={hslAdjust.s}
              lightness={hslAdjust.l}
              contrast={contrastBrightness.contrast}
              brightness={contrastBrightness.brightness}
              onHslChange={handleHslChange}
              onContrastBrightnessChange={handleContrastBrightnessChange}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Action">
            <div className="action-buttons">
              <button className="btn btn-download" onClick={download}>
                Download PNG
              </button>
              <button className="btn btn-generate-url" onClick={handleGenerateUrl}>
                Generate URL
              </button>
              {isAuthenticated && (
                <>
                  <button className="btn" onClick={handleSavePattern}>
                    Save Pattern
                  </button>
                  <button className="btn" onClick={() => setShowMyPatterns(true)}>
                    Load from My Patterns
                  </button>
                </>
              )}
              <button className="btn btn-next-step" onClick={() => setCurrentStep('compose')}>
                Compose &rarr;
              </button>
            </div>
          </CollapsibleSection>
        </div>
      )}
      {showUrlModal && (
        <div className="url-modal-overlay" onClick={() => setShowUrlModal(false)}>
          <div className="url-modal" onClick={(e) => e.stopPropagation()}>
            <div className="url-modal-title">Pattern URL</div>
            <p className="url-modal-description">
              This URL will reproduce the current pattern with all settings.
            </p>
            <textarea
              className="url-modal-textarea"
              readOnly
              value={generatedUrl}
              rows={3}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <div className="url-modal-actions">
              <button
                className="btn url-modal-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(generatedUrl).then(() => {
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 1500);
                  }).catch(() => {
                    // Fallback: select textarea text for manual copy
                    const textarea = document.querySelector('.url-modal-textarea') as HTMLTextAreaElement | null;
                    textarea?.select();
                  });
                }}
              >
                {urlCopied ? 'Copied!' : 'Copy URL'}
              </button>
              <button
                className="btn url-modal-close-btn"
                onClick={() => setShowUrlModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showSaveModal && saveModalData && (
        <SavePatternModal
          patternType={patternType}
          configJson={saveModalData.configJson}
          previewDataUrl={saveModalData.previewDataUrl}
          onClose={() => {
            setShowSaveModal(false);
            setSaveModalData(null);
          }}
          onSaved={() => {
            setShowSaveModal(false);
            setSaveModalData(null);
            showToast('Pattern saved!');
          }}
        />
      )}
      {showMyPatterns && (
        <MyPatterns
          onClose={() => setShowMyPatterns(false)}
          onLoadPattern={handleLoadPattern}
        />
      )}
      {showMyFiles && (
        <MyFiles
          onClose={() => setShowMyFiles(false)}
          onUseAsLayer={(file) => handleImageImport(file)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
