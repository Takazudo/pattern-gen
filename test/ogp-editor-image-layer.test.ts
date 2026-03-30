import { describe, it, expect } from 'vitest';
import { renderOgpEditorFromConfig } from '../src/renderer.js';
import { parseOgpEditorConfig } from '@takazudo/pattern-gen-core';
import type {
  OgpEditorConfig,
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

/** Create a solid-colour PNG data URI using node-canvas. */
async function makeSolidPngDataUri(
  color: string,
  w = 20,
  h = 20,
): Promise<string> {
  const { createCanvas } = await import('canvas');
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c.toDataURL('image/png');
}

/** Create a PNG that is half opaque colour, half transparent. */
async function makeHalfTransparentPngDataUri(): Promise<string> {
  const { createCanvas } = await import('canvas');
  const c = createCanvas(20, 20);
  const ctx = c.getContext('2d');
  // Left half: solid blue
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(0, 0, 10, 20);
  // Right half: stays transparent (default cleared state)
  return c.toDataURL('image/png');
}

function makeImageLayer(overrides: Partial<ImageLayerData> = {}): ImageLayerData {
  return {
    type: 'image',
    name: 'test-image',
    src: '', // Must be overridden with data URI
    transform: { x: 100, y: 100, width: 200, height: 200 },
    opacity: 1,
    ...overrides,
  };
}

/** Read a single pixel from a PNG buffer. */
async function getPixel(
  buffer: Buffer,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number; a: number }> {
  const { createCanvas, loadImage } = await import('canvas');
  const img = await loadImage(buffer);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
  return { r, g, b, a };
}

/** Read the background-only render for comparison. */
async function renderBackgroundOnly(): Promise<Buffer> {
  const config: OgpEditorConfig = {
    version: 1,
    background: makeValidBackground(),
    layers: [],
  };
  return (await renderOgpEditorFromConfig(config)).buffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OGP editor — image layer CLI rendering', () => {
  it('renders a solid image layer with non-transparent pixels', async () => {
    const src = await makeSolidPngDataUri('#ff0000');
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src,
          // Place image at (100,100) with 200x200 size
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        }),
      ],
    };

    const result = await renderOgpEditorFromConfig(config);
    expect(result.buffer[0]).toBe(0x89); // PNG signature

    // Check pixel in the centre of where the image should be drawn (200, 200)
    const pixel = await getPixel(result.buffer, 200, 200);
    expect(pixel.a).toBe(255); // Must be fully opaque
    expect(pixel.r).toBeGreaterThan(200); // Should be strongly red
    expect(pixel.g).toBeLessThan(50);
    expect(pixel.b).toBeLessThan(50);
  });

  it('renders differently from background-only when image is added', async () => {
    const src = await makeSolidPngDataUri('#00ff00');
    const withImage: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        }),
      ],
    };

    const bgOnly = await renderBackgroundOnly();
    const withImgResult = await renderOgpEditorFromConfig(withImage);

    // Buffers should differ because the image layer adds pixels
    expect(bgOnly.equals(withImgResult.buffer)).toBe(false);
  });

  it('produces identical output for the same config (deterministic)', async () => {
    const src = await makeSolidPngDataUri('#ff0000');
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [makeImageLayer({ src })],
    };

    const r1 = await renderOgpEditorFromConfig(config);
    const r2 = await renderOgpEditorFromConfig(config);
    expect(r1.buffer.equals(r2.buffer)).toBe(true);
  });

  it('applies partial opacity to image layer', async () => {
    const src = await makeSolidPngDataUri('#ff0000');

    const fullOpacity: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        }),
      ],
    };

    const halfOpacity: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 0.5,
        }),
      ],
    };

    const fullResult = await renderOgpEditorFromConfig(fullOpacity);
    const halfResult = await renderOgpEditorFromConfig(halfOpacity);

    // Half opacity should produce different pixels than full opacity
    expect(fullResult.buffer.equals(halfResult.buffer)).toBe(false);

    // At half opacity, the red channel should be blended with background
    const fullPixel = await getPixel(fullResult.buffer, 200, 200);
    const halfPixel = await getPixel(halfResult.buffer, 200, 200);
    // Half-opacity red over a background → less red than full opacity
    expect(halfPixel.r).toBeLessThan(fullPixel.r);
  });

  it('renders zero opacity image identically to background only', async () => {
    const src = await makeSolidPngDataUri('#ff0000');
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 0,
        }),
      ],
    };

    const bgOnly = await renderBackgroundOnly();
    const result = await renderOgpEditorFromConfig(config);
    expect(bgOnly.equals(result.buffer)).toBe(true);
  });

  it('composites multiple image layers in order (later on top)', async () => {
    const redSrc = await makeSolidPngDataUri('#ff0000');
    const blueSrc = await makeSolidPngDataUri('#0000ff');

    // Both layers cover the same area — blue is on top (later in array)
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          name: 'red-bottom',
          src: redSrc,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        }),
        makeImageLayer({
          name: 'blue-top',
          src: blueSrc,
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        }),
      ],
    };

    const result = await renderOgpEditorFromConfig(config);
    const pixel = await getPixel(result.buffer, 200, 200);

    // Blue should dominate since it's drawn on top
    expect(pixel.b).toBeGreaterThan(200);
    expect(pixel.r).toBeLessThan(50);
  });

  it('preserves transparency from source PNG', async () => {
    const src = await makeHalfTransparentPngDataUri();
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src,
          // Stretch to 200x200 at position (100,100)
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        }),
      ],
    };

    const bgOnlyBuf = await renderBackgroundOnly();
    const result = await renderOgpEditorFromConfig(config);

    // Left side of image area (x=150) should have blue from the image
    const leftPixel = await getPixel(result.buffer, 150, 200);
    expect(leftPixel.b).toBeGreaterThan(200);

    // Right side of image area (x=250) should be transparent → shows background
    const rightPixel = await getPixel(result.buffer, 250, 200);
    const bgPixel = await getPixel(bgOnlyBuf, 250, 200);
    // Right side should match background since the source is transparent there
    expect(rightPixel.r).toBe(bgPixel.r);
    expect(rightPixel.g).toBe(bgPixel.g);
    expect(rightPixel.b).toBe(bgPixel.b);
  });

  it('handles invalid image src gracefully (no crash)', async () => {
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src: 'data:image/png;base64,NOT_VALID_BASE64',
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        }),
      ],
    };

    // Should not throw — invalid image is silently skipped
    const result = await renderOgpEditorFromConfig(config);
    expect(result.buffer[0]).toBe(0x89); // Valid PNG output
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
  });

  it('renders image layer at correct position and size', async () => {
    const src = await makeSolidPngDataUri('#00ff00');
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        makeImageLayer({
          src,
          // Small image at specific position
          transform: { x: 500, y: 300, width: 50, height: 50 },
          opacity: 1,
        }),
      ],
    };

    const result = await renderOgpEditorFromConfig(config);

    // Inside the image area (525, 325) should be green
    const insidePixel = await getPixel(result.buffer, 525, 325);
    expect(insidePixel.g).toBeGreaterThan(200);

    // Outside the image area (400, 200) should match background
    const bgOnlyBuf = await renderBackgroundOnly();
    const outsidePixel = await getPixel(result.buffer, 400, 200);
    const bgPixel = await getPixel(bgOnlyBuf, 400, 200);
    expect(outsidePixel.r).toBe(bgPixel.r);
    expect(outsidePixel.g).toBe(bgPixel.g);
    expect(outsidePixel.b).toBe(bgPixel.b);
  });
});

describe('OGP editor config — image layer parsing', () => {
  it('parses config with image layer successfully', () => {
    const config = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        {
          type: 'image',
          name: 'logo',
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        },
      ],
    };

    const parsed = parseOgpEditorConfig(JSON.stringify(config));
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
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
          bgRemoval: { enabled: true, threshold: 128 },
        },
      ],
    };

    const parsed = parseOgpEditorConfig(JSON.stringify(config));
    const layer = parsed.layers[0] as ImageLayerData;
    // bgRemoval is stripped by validateImageLayer — documenting current behavior
    expect(layer.bgRemoval).toBeUndefined();
  });

  it('rejects image layer with missing src', () => {
    const config = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        {
          type: 'image',
          name: 'logo',
          src: '',
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1,
        },
      ],
    };

    expect(() => parseOgpEditorConfig(JSON.stringify(config))).toThrow(
      'src must be a non-empty string',
    );
  });

  it('rejects image layer with invalid opacity', () => {
    const config = {
      version: 1,
      background: makeValidBackground(),
      layers: [
        {
          type: 'image',
          name: 'logo',
          src: 'data:image/png;base64,abc',
          transform: { x: 100, y: 100, width: 200, height: 200 },
          opacity: 1.5,
        },
      ],
    };

    expect(() => parseOgpEditorConfig(JSON.stringify(config))).toThrow(
      'opacity must be a number in [0, 1]',
    );
  });
});
