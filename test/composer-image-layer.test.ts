import { describe, it, expect } from 'vitest';
import { createCanvas, loadImage } from 'canvas';
import { renderComposerFromConfig } from '../src/renderer.js';
import { parseComposerConfig } from '@takazudo/pattern-gen-core';
import type {
  ComposerConfig,
  ImageLayerData,
  OgpConfig,
} from '@takazudo/pattern-gen-core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidBackground(): OgpConfig {
  return {
    version: 1,
    slug: 'testslug-image',
    type: 'wood-block',
    colorScheme: 'Dracula',
    zoom: 1,
    translateX: 0,
    translateY: 0,
    useTranslate: false,
    params: {},
    hsl: { h: 0, s: 0, l: 0 },
    crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.42 },
  };
}

function makeEditorConfig(
  layers: ComposerConfig['layers'],
): ComposerConfig {
  return { version: 1, background: makeValidBackground(), layers };
}

function makeSolidPngDataUri(color: string, w = 20, h = 20): string {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c.toDataURL('image/png');
}

function makeHalfTransparentPngDataUri(): string {
  const c = createCanvas(20, 20);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(0, 0, 10, 20);
  // Right half stays transparent (default cleared state)
  return c.toDataURL('image/png');
}

function makeImageLayer(overrides: Partial<ImageLayerData>): ImageLayerData {
  return {
    type: 'image',
    name: 'test-image',
    src: '', // caller must provide src
    transform: { x: 100, y: 100, width: 200, height: 200 },
    opacity: 1,
    ...overrides,
  };
}

/** Read pixel(s) from a PNG buffer without re-decoding per call. */
async function readPixels(
  buffer: Buffer,
  coords: Array<[x: number, y: number]>,
): Promise<Array<{ r: number; g: number; b: number; a: number }>> {
  const img = await loadImage(buffer);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return coords.map(([x, y]) => {
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
    return { r, g, b, a };
  });
}

async function getPixel(
  buffer: Buffer,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number; a: number }> {
  return (await readPixels(buffer, [[x, y]]))[0];
}

let bgOnlyCache: Buffer | null = null;

async function renderBackgroundOnly(): Promise<Buffer> {
  if (!bgOnlyCache) {
    bgOnlyCache = (await renderComposerFromConfig(makeEditorConfig([]))).buffer;
  }
  return bgOnlyCache;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Composer — image layer CLI rendering', () => {
  it('renders a solid image layer with non-transparent pixels', async () => {
    const src = makeSolidPngDataUri('#ff0000');
    const config = makeEditorConfig([makeImageLayer({ src })]);

    const result = await renderComposerFromConfig(config);
    expect(result.buffer[0]).toBe(0x89); // PNG signature

    // Check pixel in the centre of where the image should be drawn (200, 200)
    const pixel = await getPixel(result.buffer, 200, 200);
    expect(pixel.a).toBe(255);
    expect(pixel.r).toBeGreaterThan(200);
    expect(pixel.g).toBeLessThan(50);
    expect(pixel.b).toBeLessThan(50);
  });

  it('renders differently from background-only when image is added', async () => {
    const src = makeSolidPngDataUri('#00ff00');
    const config = makeEditorConfig([makeImageLayer({ src })]);

    const bgOnly = await renderBackgroundOnly();
    const result = await renderComposerFromConfig(config);

    expect(bgOnly.equals(result.buffer)).toBe(false);
  });

  it('produces identical output for the same config (deterministic)', async () => {
    const src = makeSolidPngDataUri('#ff0000');
    const config = makeEditorConfig([makeImageLayer({ src })]);

    const r1 = await renderComposerFromConfig(config);
    const r2 = await renderComposerFromConfig(config);
    expect(r1.buffer.equals(r2.buffer)).toBe(true);
  });

  it('applies partial opacity to image layer', async () => {
    const src = makeSolidPngDataUri('#ff0000');

    const fullResult = await renderComposerFromConfig(
      makeEditorConfig([makeImageLayer({ src, opacity: 1 })]),
    );
    const halfResult = await renderComposerFromConfig(
      makeEditorConfig([makeImageLayer({ src, opacity: 0.5 })]),
    );

    expect(fullResult.buffer.equals(halfResult.buffer)).toBe(false);

    const fullPixel = await getPixel(fullResult.buffer, 200, 200);
    const halfPixel = await getPixel(halfResult.buffer, 200, 200);
    // Half-opacity red over background -> less red than full opacity
    expect(halfPixel.r).toBeLessThan(fullPixel.r);
  });

  it('renders zero opacity image identically to background only', async () => {
    const src = makeSolidPngDataUri('#ff0000');
    const config = makeEditorConfig([makeImageLayer({ src, opacity: 0 })]);

    const bgOnly = await renderBackgroundOnly();
    const result = await renderComposerFromConfig(config);
    expect(bgOnly.equals(result.buffer)).toBe(true);
  });

  it('composites multiple image layers in order (later on top)', async () => {
    const redSrc = makeSolidPngDataUri('#ff0000');
    const blueSrc = makeSolidPngDataUri('#0000ff');

    const config = makeEditorConfig([
      makeImageLayer({ name: 'red-bottom', src: redSrc }),
      makeImageLayer({ name: 'blue-top', src: blueSrc }),
    ]);

    const result = await renderComposerFromConfig(config);
    const pixel = await getPixel(result.buffer, 200, 200);

    // Blue should dominate since it's drawn on top
    expect(pixel.b).toBeGreaterThan(200);
    expect(pixel.r).toBeLessThan(50);
  });

  it('preserves transparency from source PNG', async () => {
    const src = makeHalfTransparentPngDataUri();
    const config = makeEditorConfig([makeImageLayer({ src })]);

    const bgOnlyBuf = await renderBackgroundOnly();
    const result = await renderComposerFromConfig(config);

    // Read all needed pixels in batch
    const [leftPixel, rightPixel] = await readPixels(result.buffer, [
      [150, 200], // left side: should have blue from image
      [250, 200], // right side: transparent -> shows background
    ]);
    const [bgPixel] = await readPixels(bgOnlyBuf, [[250, 200]]);

    expect(leftPixel.b).toBeGreaterThan(200);
    expect(rightPixel.r).toBe(bgPixel.r);
    expect(rightPixel.g).toBe(bgPixel.g);
    expect(rightPixel.b).toBe(bgPixel.b);
  });

  it('handles invalid image src gracefully (no crash, matches background)', async () => {
    const config = makeEditorConfig([
      makeImageLayer({ src: 'data:image/png;base64,NOT_VALID_BASE64' }),
    ]);

    const bgOnly = await renderBackgroundOnly();
    const result = await renderComposerFromConfig(config);
    expect(result.buffer[0]).toBe(0x89);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    // Failed image load is a no-op — output should match background only
    expect(bgOnly.equals(result.buffer)).toBe(true);
  });

  it('renders image layer at correct position and size', async () => {
    const src = makeSolidPngDataUri('#00ff00');
    const config = makeEditorConfig([
      makeImageLayer({
        src,
        transform: { x: 500, y: 300, width: 50, height: 50 },
      }),
    ]);

    const result = await renderComposerFromConfig(config);
    const bgOnlyBuf = await renderBackgroundOnly();

    const [insidePixel, outsidePixel] = await readPixels(result.buffer, [
      [525, 325], // inside image area
      [400, 200], // outside image area
    ]);
    const [bgPixel] = await readPixels(bgOnlyBuf, [[400, 200]]);

    expect(insidePixel.g).toBeGreaterThan(200);
    expect(outsidePixel.r).toBe(bgPixel.r);
    expect(outsidePixel.g).toBe(bgPixel.g);
    expect(outsidePixel.b).toBe(bgPixel.b);
  });
});

describe('Composer config — image layer parsing', () => {
  const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  it('parses config with image layer successfully', () => {
    const config = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        {
          type: 'image',
          name: 'logo',
          src: TINY_PNG,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        },
      ],
    };

    const parsed = parseComposerConfig(JSON.stringify(config));
    expect(parsed.layers).toHaveLength(1);
    expect(parsed.layers[0].type).toBe('image');
    expect((parsed.layers[0] as ImageLayerData).name).toBe('logo');
    expect((parsed.layers[0] as ImageLayerData).opacity).toBe(1);
  });

  it('strips bgRemoval field during parsing (not preserved)', () => {
    const config = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        {
          type: 'image',
          name: 'logo',
          src: TINY_PNG,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
          bgRemoval: { enabled: true, threshold: 128 },
        },
      ],
    };

    const parsed = parseComposerConfig(JSON.stringify(config));
    const layer = parsed.layers[0] as ImageLayerData;
    // bgRemoval is stripped by validateImageLayer — documenting current behavior
    expect(layer.bgRemoval).toBeUndefined();
  });
});
