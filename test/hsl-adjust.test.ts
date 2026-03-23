import { describe, it, expect } from 'vitest';
import { rgbToHsl, hslToRgb } from '../src/core/color-utils.js';

describe('rgbToHsl', () => {
  it('converts red', () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBeCloseTo(0, 1);
    expect(hsl.s).toBeCloseTo(100, 1);
    expect(hsl.l).toBeCloseTo(50, 1);
  });

  it('converts green', () => {
    const hsl = rgbToHsl(0, 255, 0);
    expect(hsl.h).toBeCloseTo(120, 1);
    expect(hsl.s).toBeCloseTo(100, 1);
    expect(hsl.l).toBeCloseTo(50, 1);
  });

  it('converts blue', () => {
    const hsl = rgbToHsl(0, 0, 255);
    expect(hsl.h).toBeCloseTo(240, 1);
    expect(hsl.s).toBeCloseTo(100, 1);
    expect(hsl.l).toBeCloseTo(50, 1);
  });

  it('converts white', () => {
    const hsl = rgbToHsl(255, 255, 255);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(100, 1);
  });

  it('converts black', () => {
    const hsl = rgbToHsl(0, 0, 0);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });

  it('converts mid-gray', () => {
    const hsl = rgbToHsl(128, 128, 128);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(50.2, 0);
  });
});

describe('hslToRgb', () => {
  it('converts red', () => {
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0]);
  });

  it('converts green', () => {
    expect(hslToRgb(120, 100, 50)).toEqual([0, 255, 0]);
  });

  it('converts blue', () => {
    expect(hslToRgb(240, 100, 50)).toEqual([0, 0, 255]);
  });

  it('converts white', () => {
    expect(hslToRgb(0, 0, 100)).toEqual([255, 255, 255]);
  });

  it('converts black', () => {
    expect(hslToRgb(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it('converts mid-gray', () => {
    const [r, g, b] = hslToRgb(0, 0, 50);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBe(128);
  });
});

describe('rgbToHsl/hslToRgb roundtrip', () => {
  const testColors: [number, number, number][] = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
    [255, 255, 255],
    [0, 0, 0],
    [128, 128, 128],
    [192, 64, 32],
  ];

  for (const [r, g, b] of testColors) {
    it(`roundtrips (${r}, ${g}, ${b})`, () => {
      const hsl = rgbToHsl(r, g, b);
      const [r2, g2, b2] = hslToRgb(hsl.h, hsl.s, hsl.l);
      expect(r2).toBeCloseTo(r, 0);
      expect(g2).toBeCloseTo(g, 0);
      expect(b2).toBeCloseTo(b, 0);
    });
  }
});

describe('edge cases', () => {
  it('pure colors have 100% saturation', () => {
    expect(rgbToHsl(255, 0, 0).s).toBeCloseTo(100, 1);
    expect(rgbToHsl(0, 255, 0).s).toBeCloseTo(100, 1);
    expect(rgbToHsl(0, 0, 255).s).toBeCloseTo(100, 1);
  });

  it('desaturated colors have 0% saturation', () => {
    expect(rgbToHsl(0, 0, 0).s).toBe(0);
    expect(rgbToHsl(128, 128, 128).s).toBe(0);
    expect(rgbToHsl(255, 255, 255).s).toBe(0);
  });

  it('hslToRgb handles hue at 360 (wraps to 0)', () => {
    // 360 degrees should be same as 0 degrees
    expect(hslToRgb(360, 100, 50)).toEqual(hslToRgb(0, 100, 50));
  });
});
