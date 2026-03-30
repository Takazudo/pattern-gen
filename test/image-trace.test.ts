import { describe, it, expect, beforeAll } from 'vitest';
import {
  flattenAlpha,
  DEFAULT_TRACE_OPTIONS,
} from '../packages/pattern-gen-viewer/src/utils/image-trace-utils.js';

// Polyfill ImageData for Node.js test environment
beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as Record<string, unknown>).ImageData = class ImageData {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
      constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
        if (dataOrWidth instanceof Uint8ClampedArray) {
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = height ?? (dataOrWidth.length / 4 / widthOrHeight);
        } else {
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
      }
    };
  }
});

function createTestImageData(
  width: number,
  height: number,
  fill: [number, number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return new ImageData(data, width, height);
}

describe('flattenAlpha', () => {
  it('preserves fully opaque pixels unchanged', () => {
    const input = createTestImageData(2, 2, [255, 0, 0, 255]);
    const result = flattenAlpha(input);
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(255);     // R
      expect(result.data[i + 1]).toBe(0);   // G
      expect(result.data[i + 2]).toBe(0);   // B
      expect(result.data[i + 3]).toBe(255); // A
    }
  });

  it('converts fully transparent pixels to white', () => {
    const input = createTestImageData(2, 2, [255, 0, 0, 0]);
    const result = flattenAlpha(input);
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(255);     // R (white)
      expect(result.data[i + 1]).toBe(255); // G (white)
      expect(result.data[i + 2]).toBe(255); // B (white)
      expect(result.data[i + 3]).toBe(255); // A
    }
  });

  it('composites semi-transparent black onto white as gray', () => {
    const input = createTestImageData(1, 1, [0, 0, 0, 128]);
    const result = flattenAlpha(input);
    const r = result.data[0];
    const g = result.data[1];
    const b = result.data[2];
    // 0 * (128/255) + 255 * (1 - 128/255) ≈ 127
    expect(r).toBeGreaterThanOrEqual(126);
    expect(r).toBeLessThanOrEqual(128);
    expect(g).toBe(r);
    expect(b).toBe(r);
    expect(result.data[3]).toBe(255);
  });

  it('composites semi-transparent color correctly', () => {
    const input = createTestImageData(1, 1, [255, 0, 0, 128]);
    const result = flattenAlpha(input);
    const a = 128 / 255;
    const expectedR = Math.round(255 * a + 255 * (1 - a)); // 255
    const expectedG = Math.round(0 * a + 255 * (1 - a));   // ~127
    expect(result.data[0]).toBe(expectedR);
    expect(result.data[1]).toBe(expectedG);
    expect(result.data[2]).toBe(expectedG);
    expect(result.data[3]).toBe(255);
  });

  it('preserves dimensions', () => {
    const input = createTestImageData(50, 30, [0, 0, 0, 255]);
    const result = flattenAlpha(input);
    expect(result.width).toBe(50);
    expect(result.height).toBe(30);
  });

  it('sets all alpha values to 255', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    const alphas = [0, 64, 128, 255];
    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      data[offset] = 100;
      data[offset + 1] = 150;
      data[offset + 2] = 200;
      data[offset + 3] = alphas[i];
    }
    for (let i = 16; i < data.length; i += 4) {
      data[i] = 50;
      data[i + 1] = 100;
      data[i + 2] = 150;
      data[i + 3] = 100;
    }
    const input = new ImageData(data, 4, 4);
    const result = flattenAlpha(input);
    for (let i = 3; i < result.data.length; i += 4) {
      expect(result.data[i]).toBe(255);
    }
  });

  it('handles mixed pixel pattern correctly', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    // Pixel 0: fully opaque green
    data.set([0, 255, 0, 255], 0);
    // Pixel 1: fully transparent blue → white
    data.set([0, 0, 255, 0], 4);
    // Pixel 2: 50% red
    data.set([255, 0, 0, 128], 8);
    // Pixel 3: very low alpha (below library's threshold of 13)
    data.set([0, 0, 0, 10], 12);

    const input = new ImageData(data, 2, 2);
    const result = flattenAlpha(input);

    // Pixel 0: green stays green
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(0);

    // Pixel 1: transparent blue → white
    expect(result.data[4]).toBe(255);
    expect(result.data[5]).toBe(255);
    expect(result.data[6]).toBe(255);

    // Pixel 2: 50% red → pinkish
    expect(result.data[8]).toBe(255);
    expect(result.data[9]).toBeGreaterThan(100);

    // Pixel 3: near-transparent black → near-white (NOT invisible)
    expect(result.data[12]).toBeGreaterThan(240);
    expect(result.data[13]).toBeGreaterThan(240);
    expect(result.data[14]).toBeGreaterThan(240);
    expect(result.data[15]).toBe(255);
  });
});

describe('DEFAULT_TRACE_OPTIONS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_TRACE_OPTIONS).toEqual({
      numberOfColors: 16,
      minPathSegments: 0,
      blurRadius: 0,
      blurDelta: 20,
      strokeWidth: 1,
      lineErrorMargin: 1,
      curveErrorMargin: 1,
    });
  });
});

describe('traceImageData SVG output', () => {
  // The browser wrapper needs `window` at module scope
  let ImageTracer: typeof import('@image-tracer-ts/browser').ImageTracer;
  let traceImageData: typeof import('../packages/pattern-gen-viewer/src/utils/image-trace.js').traceImageData;

  beforeAll(async () => {
    if (typeof globalThis.window === 'undefined') {
      (globalThis as Record<string, unknown>).window = globalThis;
    }
    const coreMod = await import('@image-tracer-ts/browser');
    ImageTracer = coreMod.ImageTracer;
    const traceMod = await import(
      '../packages/pattern-gen-viewer/src/utils/image-trace.js'
    );
    traceImageData = traceMod.traceImageData;
  });

  it('produces SVG with explicit width and height when viewBox is false', () => {
    const width = 20, height = 10;
    const imageData = createTestImageData(width, height, [255, 0, 0, 255]);
    const tracer = new ImageTracer({
      numberOfColors: 4,
      minShapeOutline: 0,
      viewBox: false,
    });
    const svg = tracer.traceImageToSvg(imageData);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
    expect(svg).not.toContain('viewBox');
  });

  it('produces SVG with viewBox only when viewBox is true', () => {
    const width = 20, height = 10;
    const imageData = createTestImageData(width, height, [255, 0, 0, 255]);
    const tracer = new ImageTracer({
      numberOfColors: 4,
      minShapeOutline: 0,
      viewBox: true,
    });
    const svg = tracer.traceImageToSvg(imageData);
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(svg).not.toContain('width="20"');
    expect(svg).not.toContain('height="10"');
  });

  it('produces SVG with valid path elements', () => {
    const imageData = createTestImageData(10, 10, [0, 128, 255, 255]);
    const tracer = new ImageTracer({
      numberOfColors: 4,
      minShapeOutline: 0,
      viewBox: false,
    });
    const svg = tracer.traceImageToSvg(imageData);
    expect(svg).toContain('<path');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('traceImageData wrapper emits width/height (not viewBox)', async () => {
    const imageData = createTestImageData(30, 20, [100, 50, 200, 255]);
    const svg = await traceImageData(imageData);
    expect(svg).toContain('width="30"');
    expect(svg).toContain('height="20"');
    expect(svg).not.toContain('viewBox');
    expect(svg).toContain('<path');
  });

  it('traceImageData handles semi-transparent input via flattenAlpha', async () => {
    // Semi-transparent black → flattenAlpha composites onto white → gray
    const imageData = createTestImageData(10, 10, [0, 0, 0, 128]);
    const svg = await traceImageData(imageData);
    expect(svg).toContain('width="10"');
    expect(svg).toContain('<path');
    // The path fill should be gray-ish (not black, not white) from compositing
    expect(svg).toMatch(/rgb\(\d+,\d+,\d+\)/);
  });
});
