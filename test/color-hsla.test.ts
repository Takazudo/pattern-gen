import { describe, it, expect } from 'vitest';
import {
  hexToHsla,
  hslaToHex,
  hslaToString,
  parseHslaString,
} from '../packages/pattern-gen-viewer/src/utils/color-hsla.js';

describe('hexToHsla', () => {
  it('parses #RRGGBB (no alpha) → a=100', () => {
    const result = hexToHsla('#ff0000');
    expect(result).toEqual({ h: 0, s: 100, l: 50, a: 100 });
  });

  it('parses #RRGGBBAA with alpha', () => {
    const result = hexToHsla('#ff000080');
    expect(result.a).toBe(50); // 0x80 = 128 → 128/255 ≈ 0.502 → 50%
  });

  it('parses black', () => {
    expect(hexToHsla('#000000')).toEqual({ h: 0, s: 0, l: 0, a: 100 });
  });

  it('parses white', () => {
    expect(hexToHsla('#ffffff')).toEqual({ h: 0, s: 0, l: 100, a: 100 });
  });

  it('returns fallback for invalid input', () => {
    expect(hexToHsla('')).toEqual({ h: 0, s: 0, l: 0, a: 100 });
    expect(hexToHsla('not-a-color')).toEqual({ h: 0, s: 0, l: 0, a: 100 });
    expect(hexToHsla('#gg0000')).toEqual({ h: 0, s: 0, l: 0, a: 100 });
  });

  it('parses fully transparent', () => {
    expect(hexToHsla('#ff000000')).toEqual({ h: 0, s: 100, l: 50, a: 0 });
  });
});

describe('hslaToHex', () => {
  it('converts pure red', () => {
    expect(hslaToHex(0, 100, 50, 100)).toBe('#ff0000');
  });

  it('converts with alpha < 100 → #RRGGBBAA', () => {
    const hex = hslaToHex(0, 100, 50, 50);
    expect(hex).toMatch(/^#ff0000[0-9a-f]{2}$/);
    expect(hex.length).toBe(9);
  });

  it('converts a=100 → #RRGGBB (no alpha suffix)', () => {
    const hex = hslaToHex(120, 100, 50, 100);
    expect(hex).toBe('#00ff00');
    expect(hex.length).toBe(7);
  });

  it('converts black', () => {
    expect(hslaToHex(0, 0, 0, 100)).toBe('#000000');
  });

  it('converts white', () => {
    expect(hslaToHex(0, 0, 100, 100)).toBe('#ffffff');
  });
});

describe('hslaToHex ↔ hexToHsla roundtrip', () => {
  const testCases = [
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffffff',
    '#000000',
    '#808080',
    '#ff000080',
    '#00ff0040',
  ];

  for (const hex of testCases) {
    it(`roundtrips ${hex}`, () => {
      const hsla = hexToHsla(hex);
      const back = hslaToHex(hsla.h, hsla.s, hsla.l, hsla.a);
      // Allow ±1 per channel due to integer rounding
      const origR = parseInt(hex.slice(1, 3), 16);
      const origG = parseInt(hex.slice(3, 5), 16);
      const origB = parseInt(hex.slice(5, 7), 16);
      const backR = parseInt(back.slice(1, 3), 16);
      const backG = parseInt(back.slice(3, 5), 16);
      const backB = parseInt(back.slice(5, 7), 16);
      expect(Math.abs(origR - backR)).toBeLessThanOrEqual(2);
      expect(Math.abs(origG - backG)).toBeLessThanOrEqual(2);
      expect(Math.abs(origB - backB)).toBeLessThanOrEqual(2);
    });
  }
});

describe('hslaToString', () => {
  it('formats as CSS hsla()', () => {
    expect(hslaToString(0, 100, 50, 100)).toBe('hsla(0, 100%, 50%, 1)');
  });

  it('formats with fractional alpha', () => {
    expect(hslaToString(180, 50, 50, 50)).toBe('hsla(180, 50%, 50%, 0.5)');
  });
});

describe('parseHslaString', () => {
  it('parses hsla() string', () => {
    expect(parseHslaString('hsla(0, 100%, 50%, 1)')).toEqual({
      h: 0,
      s: 100,
      l: 50,
      a: 100,
    });
  });

  it('parses with fractional alpha', () => {
    expect(parseHslaString('hsla(180, 50%, 50%, 0.5)')).toEqual({
      h: 180,
      s: 50,
      l: 50,
      a: 50,
    });
  });

  it('returns null for invalid string', () => {
    expect(parseHslaString('not-a-color')).toBeNull();
    expect(parseHslaString('#ff0000')).toBeNull();
  });
});
