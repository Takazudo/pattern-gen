import { describe, it, expect } from 'vitest';
import { createCanvas } from 'canvas';
import { createRandom, COLOR_SCHEMES } from '@takazudo/pattern-gen-core';
import type { PatternOptions } from '@takazudo/pattern-gen-core';
import { patternsByName } from '@takazudo/pattern-gen-generators';

/** Small canvas size for fast tests */
const SIZE = 100;

/** Shared color scheme for deterministic output */
const TEST_SCHEME = COLOR_SCHEMES[0];

/** Seed value for deterministic PRNG */
const SEED = 42;

/** Build PatternOptions with defaults, optionally overriding zoom */
function makeOptions(overrides?: Partial<PatternOptions>): PatternOptions {
  return {
    width: SIZE,
    height: SIZE,
    rand: createRandom(SEED),
    colorScheme: TEST_SCHEME,
    zoom: 1,
    ...overrides,
  };
}

/** Get raw pixel data from rendering a pattern directly */
function renderDirect(
  patternName: string,
  options: PatternOptions,
): Uint8ClampedArray {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);
  const pattern = patternsByName.get(patternName)!;
  pattern.generate(ctx as unknown as CanvasRenderingContext2D, options);
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}

/**
 * Render a pattern onto an offscreen canvas, then drawImage onto a main
 * canvas with translate applied. This mimics the viewer's approach for
 * handling putImageData-based patterns that ignore ctx.translate().
 */
function renderWithOffscreenTranslate(
  patternName: string,
  options: PatternOptions,
  tx: number,
  ty: number,
): Uint8ClampedArray {
  const pattern = patternsByName.get(patternName)!;

  // Render pattern onto offscreen canvas
  const offscreen = createCanvas(SIZE, SIZE);
  const offCtx = offscreen.getContext('2d');
  offCtx.clearRect(0, 0, SIZE, SIZE);
  pattern.generate(offCtx as unknown as CanvasRenderingContext2D, options);

  // Draw offscreen result onto main canvas with translate
  const main = createCanvas(SIZE, SIZE);
  const mainCtx = main.getContext('2d');
  mainCtx.clearRect(0, 0, SIZE, SIZE);
  mainCtx.save();
  mainCtx.translate(tx, ty);
  mainCtx.drawImage(offscreen, 0, 0);
  mainCtx.restore();

  return mainCtx.getImageData(0, 0, SIZE, SIZE).data;
}

/** Get RGBA values at a specific pixel coordinate from raw pixel data */
function getPixel(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width = SIZE,
): [number, number, number, number] {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

/** Check if two pixel arrays are identical */
function pixelsEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Count how many pixels differ between two image data arrays */
function countDifferentPixels(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Test 1: Zoom changes pattern output
// ---------------------------------------------------------------------------
describe('zoom changes pattern output', () => {
  it('chevron at zoom=1 differs from zoom=2', () => {
    const dataZoom1 = renderDirect('chevron', makeOptions({ zoom: 1 }));
    const dataZoom2 = renderDirect('chevron', makeOptions({ zoom: 2 }));

    expect(pixelsEqual(dataZoom1, dataZoom2)).toBe(false);
    // Significant portion should differ — not just a few pixels
    const diffCount = countDifferentPixels(dataZoom1, dataZoom2);
    expect(diffCount).toBeGreaterThan(SIZE * SIZE * 0.05);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Zoom scales across multiple patterns
// ---------------------------------------------------------------------------
describe('zoom scales across multiple patterns', () => {
  // These patterns all use canvas drawing APIs and reference options.zoom
  const canvasPatterns = ['chevron', 'truchet', 'herringbone'];

  for (const name of canvasPatterns) {
    it(`${name} produces different output at zoom=1 vs zoom=2`, () => {
      const dataZoom1 = renderDirect(name, makeOptions({ zoom: 1 }));
      const dataZoom2 = renderDirect(name, makeOptions({ zoom: 2 }));

      expect(pixelsEqual(dataZoom1, dataZoom2)).toBe(false);
      const diffCount = countDifferentPixels(dataZoom1, dataZoom2);
      expect(diffCount).toBeGreaterThan(SIZE * SIZE * 0.05);
    });
  }

  it('zoom is deterministic — same zoom+seed = same output', () => {
    const data1 = renderDirect('chevron', makeOptions({ zoom: 1.5 }));
    const data2 = renderDirect('chevron', makeOptions({ zoom: 1.5 }));

    expect(pixelsEqual(data1, data2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Translate shifts canvas-drawn patterns
// ---------------------------------------------------------------------------
describe('translate shifts canvas-drawn patterns', () => {
  it('chevron shifted by (50,0) moves pixel content rightward', () => {
    const noTranslate = renderWithOffscreenTranslate('chevron', makeOptions(), 0, 0);
    const translated = renderWithOffscreenTranslate(
      'chevron',
      makeOptions(),
      50,
      0,
    );

    expect(pixelsEqual(noTranslate, translated)).toBe(false);

    // Pixel at (50,0) in the translated image should match pixel at (0,0)
    // in the non-translated image, because the whole image was shifted right 50px
    const originalPixel = getPixel(noTranslate, 0, 0);
    const shiftedPixel = getPixel(translated, 50, 0);
    expect(shiftedPixel).toEqual(originalPixel);
  });

  it('chevron shifted by (0,30) moves pixel content downward', () => {
    const noTranslate = renderWithOffscreenTranslate(
      'chevron',
      makeOptions(),
      0,
      0,
    );
    const translated = renderWithOffscreenTranslate(
      'chevron',
      makeOptions(),
      0,
      30,
    );

    expect(pixelsEqual(noTranslate, translated)).toBe(false);

    // Pixel at (0,30) in the translated image should match pixel at (0,0)
    const originalPixel = getPixel(noTranslate, 0, 0);
    const shiftedPixel = getPixel(translated, 0, 30);
    expect(shiftedPixel).toEqual(originalPixel);
  });

  it('herringbone shifted by (20,20) moves pixel content diagonally', () => {
    const noTranslate = renderWithOffscreenTranslate(
      'herringbone',
      makeOptions(),
      0,
      0,
    );
    const translated = renderWithOffscreenTranslate(
      'herringbone',
      makeOptions(),
      20,
      20,
    );

    expect(pixelsEqual(noTranslate, translated)).toBe(false);

    // Check a few pixels along the diagonal shift
    for (const [sx, sy] of [[0, 0], [10, 10], [30, 30]] as const) {
      const origPixel = getPixel(noTranslate, sx, sy);
      const shiftPixel = getPixel(translated, sx + 20, sy + 20);
      expect(shiftPixel).toEqual(origPixel);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 4: putImageData patterns respond to offscreen+drawImage translate
// ---------------------------------------------------------------------------
describe('putImageData patterns respond to offscreen+drawImage translate', () => {
  it('domain-warp shifted by (50,0) via offscreen canvas moves content right', () => {
    const noTranslate = renderWithOffscreenTranslate('domain-warp', makeOptions(), 0, 0);
    const translated = renderWithOffscreenTranslate(
      'domain-warp',
      makeOptions(),
      50,
      0,
    );

    // Images should differ
    expect(pixelsEqual(noTranslate, translated)).toBe(false);

    // Pixel at (50,0) in translated should match pixel at (0,0) in original
    const originalPixel = getPixel(noTranslate, 0, 0);
    const shiftedPixel = getPixel(translated, 50, 0);
    expect(shiftedPixel).toEqual(originalPixel);
  });

  it('domain-warp shifted by (0,40) via offscreen canvas moves content down', () => {
    const noTranslate = renderWithOffscreenTranslate(
      'domain-warp',
      makeOptions(),
      0,
      0,
    );
    const translated = renderWithOffscreenTranslate(
      'domain-warp',
      makeOptions(),
      0,
      40,
    );

    expect(pixelsEqual(noTranslate, translated)).toBe(false);

    // Check multiple pixels along the vertical shift
    for (const x of [0, 25, 50]) {
      const origPixel = getPixel(noTranslate, x, 0);
      const shiftPixel = getPixel(translated, x, 40);
      expect(shiftPixel).toEqual(origPixel);
    }
  });

  it('marble shifted by (30,20) via offscreen canvas moves content diagonally', () => {
    // marble also uses putImageData
    const noTranslate = renderWithOffscreenTranslate(
      'marble',
      makeOptions(),
      0,
      0,
    );
    const translated = renderWithOffscreenTranslate(
      'marble',
      makeOptions(),
      30,
      20,
    );

    expect(pixelsEqual(noTranslate, translated)).toBe(false);

    const origPixel = getPixel(noTranslate, 0, 0);
    const shiftPixel = getPixel(translated, 30, 20);
    expect(shiftPixel).toEqual(origPixel);
  });

  it('direct ctx.translate does NOT move putImageData patterns (regression proof)', () => {
    // Demonstrate that applying ctx.translate directly before a putImageData
    // pattern does NOT shift the output — this is the bug the offscreen
    // approach fixes
    const pattern = patternsByName.get('domain-warp')!;

    // Render without translate
    const canvas1 = createCanvas(SIZE, SIZE);
    const ctx1 = canvas1.getContext('2d');
    ctx1.clearRect(0, 0, SIZE, SIZE);
    pattern.generate(
      ctx1 as unknown as CanvasRenderingContext2D,
      makeOptions(),
    );
    const dataNoTranslate = ctx1.getImageData(0, 0, SIZE, SIZE).data;

    // Render with ctx.translate (which putImageData ignores)
    const canvas2 = createCanvas(SIZE, SIZE);
    const ctx2 = canvas2.getContext('2d');
    ctx2.clearRect(0, 0, SIZE, SIZE);
    ctx2.save();
    ctx2.translate(50, 0);
    pattern.generate(
      ctx2 as unknown as CanvasRenderingContext2D,
      makeOptions(),
    );
    ctx2.restore();
    const dataWithTranslate = ctx2.getImageData(0, 0, SIZE, SIZE).data;

    // putImageData ignores transforms, so these should be identical
    expect(pixelsEqual(dataNoTranslate, dataWithTranslate)).toBe(true);
  });
});
