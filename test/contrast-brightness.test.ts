import { describe, it, expect } from 'vitest';
import { applyContrastBrightness } from '@takazudo/pattern-gen-core';

/**
 * Minimal mock of CanvasRenderingContext2D for testing pixel manipulation.
 */
function createMockCtx(pixels: number[]): CanvasRenderingContext2D {
  const data = new Uint8ClampedArray(pixels);
  return {
    getImageData: () => ({ data, width: 1, height: pixels.length / 4 }),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D;
}

describe('applyContrastBrightness', () => {
  it('is a no-op when both contrast and brightness are 0', () => {
    const pixels = [128, 64, 200, 255];
    const ctx = createMockCtx(pixels);
    applyContrastBrightness(ctx, 1, 1, { contrast: 0, brightness: 0 });
    // getImageData won't even be called — pixels stay unchanged
    expect(pixels).toEqual([128, 64, 200, 255]);
  });

  it('increases pixel values with positive brightness', () => {
    // brightness +50 → offset = 50 * 255 / 100 = 127.5
    // For pixel 100: val = 100 + 127.5 = 227.5, then contrast=0 → factor=1 → (227.5-128)*1+128 = 227.5 → 228
    const pixels = [100, 100, 100, 255];
    const ctx = createMockCtx(pixels);
    const data = (ctx.getImageData(0, 0, 1, 1) as ImageData).data;
    applyContrastBrightness(ctx, 1, 1, { contrast: 0, brightness: 50 });
    // Each R/G/B channel should increase
    expect(data[0]).toBeGreaterThan(100);
    expect(data[1]).toBeGreaterThan(100);
    expect(data[2]).toBeGreaterThan(100);
    // Alpha unchanged
    expect(data[3]).toBe(255);
  });

  it('decreases pixel values with negative brightness', () => {
    const pixels = [200, 200, 200, 255];
    const ctx = createMockCtx(pixels);
    const data = (ctx.getImageData(0, 0, 1, 1) as ImageData).data;
    applyContrastBrightness(ctx, 1, 1, { contrast: 0, brightness: -50 });
    expect(data[0]).toBeLessThan(200);
    expect(data[1]).toBeLessThan(200);
    expect(data[2]).toBeLessThan(200);
  });

  it('increases contrast with positive contrast value', () => {
    // With contrast=50, factor = 150/100 = 1.5
    // Dark pixel (64): (64-128)*1.5+128 = -96+128 = 32 → darker
    // Light pixel (192): (192-128)*1.5+128 = 96+128 = 224 → lighter
    const pixels = [64, 128, 192, 255];
    const ctx = createMockCtx(pixels);
    const data = (ctx.getImageData(0, 0, 1, 1) as ImageData).data;
    applyContrastBrightness(ctx, 1, 1, { contrast: 50, brightness: 0 });
    // Dark channel should get darker
    expect(data[0]).toBeLessThan(64);
    // Mid should stay roughly at 128
    expect(data[1]).toBe(128);
    // Light channel should get lighter
    expect(data[2]).toBeGreaterThan(192);
  });

  it('clamps values to 0-255 range', () => {
    // Very high brightness + high contrast should clamp at 255
    const pixels = [250, 5, 128, 255];
    const ctx = createMockCtx(pixels);
    const data = (ctx.getImageData(0, 0, 1, 1) as ImageData).data;
    applyContrastBrightness(ctx, 1, 1, { contrast: 100, brightness: 100 });
    expect(data[0]).toBe(255);
    expect(data[1]).toBeLessThanOrEqual(255);
    expect(data[1]).toBeGreaterThanOrEqual(0);
  });

  it('applies combined contrast and brightness correctly', () => {
    // brightness=20 → offset = 51, contrast=30 → factor = 1.3
    // Pixel 100: val = 100+51 = 151, then (151-128)*1.3+128 = 29.9+128 = 157.9 → 158
    const pixels = [100, 100, 100, 255];
    const ctx = createMockCtx(pixels);
    const data = (ctx.getImageData(0, 0, 1, 1) as ImageData).data;
    applyContrastBrightness(ctx, 1, 1, { contrast: 30, brightness: 20 });
    const expected = Math.round((100 + (20 * 255) / 100 - 128) * 1.3 + 128);
    expect(data[0]).toBe(expected);
    expect(data[1]).toBe(expected);
    expect(data[2]).toBe(expected);
    // Alpha unchanged
    expect(data[3]).toBe(255);
  });

  it('does not modify alpha channel', () => {
    const pixels = [100, 100, 100, 128];
    const ctx = createMockCtx(pixels);
    const data = (ctx.getImageData(0, 0, 1, 1) as ImageData).data;
    applyContrastBrightness(ctx, 1, 1, { contrast: 50, brightness: 30 });
    expect(data[3]).toBe(128);
  });
});
