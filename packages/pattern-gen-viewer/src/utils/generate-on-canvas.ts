import {
  hashString,
  createRandom,
  COLOR_SCHEMES,
} from '@takazudo/pattern-gen-core';
import type { PatternOptions } from '@takazudo/pattern-gen-core';
import { patternsByName } from '@takazudo/pattern-gen-generators';

/**
 * Render a pattern onto a canvas element.
 * Used by both the editor (TabContent) and the home page tile previews.
 */
export function generateOnCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
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
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
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

    const ow = canvas.width * scale;
    const oh = canvas.height * scale;
    const offscreen = new OffscreenCanvas(ow, oh);
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) {
      pattern.generate(ctx, options);
      return;
    }
    pattern.generate(offCtx as unknown as CanvasRenderingContext2D, {
      ...options,
      width: ow,
      height: oh,
      zoom: zoom * scale,
    });

    const tx = translateX * canvas.width;
    const ty = translateY * canvas.height;
    const baseOffset = -canvas.width * (scale - 1) / 2;
    ctx.save();

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);

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

/**
 * Simplified preview renderer for home page tiles.
 * No transforms, no user overrides — just pattern + seed + color scheme.
 */
export function generatePreview(
  canvas: HTMLCanvasElement,
  slug: string,
  patternType: string,
  colorSchemeIndex: number,
  zoom = 1,
) {
  generateOnCanvas(canvas, slug, patternType, colorSchemeIndex, zoom, 0, 0, {}, false, 0, 0, 0);
}
