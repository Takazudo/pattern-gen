import { describe, it, expect } from 'vitest';
import { hashString } from '../src/core/hash.js';
import { createRandom } from '../src/core/seeded-random.js';
import { createNoise2D, fbm } from '../src/core/noise.js';
import { hexToRgb, rgbToHex, lerpColor, darken, lighten } from '../src/core/color-utils.js';
import { COLOR_SCHEMES, normalizeSchemeKey, colorSchemesByKey } from '../src/core/color-schemes.js';
import { patternRegistry, patternsByName, getPatternNames } from '../src/patterns/index.js';
import { getParam } from '../src/core/param-utils.js';
import type { ParamDef, PatternOptions } from '../src/core/types.js';

describe('hashString', () => {
  it('returns a consistent hash for the same input', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
  });

  it('returns different hashes for different inputs', () => {
    expect(hashString('hello')).not.toBe(hashString('world'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const hash = hashString('test');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});

describe('createRandom', () => {
  it('returns deterministic sequences from the same seed', () => {
    const r1 = createRandom(42);
    const r2 = createRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it('returns values in [0, 1) range', () => {
    const rand = createRandom(123);
    for (let i = 0; i < 100; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('noise', () => {
  it('returns deterministic noise from seeded PRNG', () => {
    const r1 = createRandom(42);
    const r2 = createRandom(42);
    const n1 = createNoise2D(r1);
    const n2 = createNoise2D(r2);
    expect(n1(1.5, 2.3)).toBe(n2(1.5, 2.3));
  });

  it('returns values in [-1, 1] range', () => {
    const rand = createRandom(42);
    const noise = createNoise2D(rand);
    for (let i = 0; i < 100; i++) {
      const v = noise(i * 0.1, i * 0.2);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('fbm returns values in approximately [-1, 1]', () => {
    const rand = createRandom(42);
    const noise = createNoise2D(rand);
    for (let i = 0; i < 100; i++) {
      const v = fbm(noise, i * 0.1, i * 0.2, 4);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
    }
  });
});

describe('color-utils', () => {
  it('hexToRgb parses correctly', () => {
    expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]);
    expect(hexToRgb('#00ff00')).toEqual([0, 255, 0]);
    expect(hexToRgb('#2d2d2d')).toEqual([45, 45, 45]);
  });

  it('rgbToHex converts correctly', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
  });

  it('lerpColor interpolates', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('darken reduces brightness', () => {
    const result = darken('#ffffff', 0.5);
    expect(hexToRgb(result)).toEqual([128, 128, 128]);
  });

  it('lighten increases brightness', () => {
    const result = lighten('#000000', 0.5);
    expect(hexToRgb(result)).toEqual([128, 128, 128]);
  });
});

describe('color-schemes', () => {
  it('has at least 30 schemes', () => {
    expect(COLOR_SCHEMES.length).toBeGreaterThanOrEqual(30);
  });

  it('each scheme has 8-color palette', () => {
    for (const scheme of COLOR_SCHEMES) {
      expect(scheme.palette).toHaveLength(8);
    }
  });

  it('normalizeSchemeKey is case-insensitive', () => {
    expect(normalizeSchemeKey('Rose Pine Moon')).toBe('rose-pine-moon');
    expect(normalizeSchemeKey('DRACULA')).toBe('dracula');
  });

  it('colorSchemesByKey lookup works', () => {
    const found = colorSchemesByKey.get('nord');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Nord');
  });
});

describe('pattern registry', () => {
  it('has at least one pattern', () => {
    expect(patternRegistry.length).toBeGreaterThanOrEqual(1);
  });

  it('wood-block pattern is registered', () => {
    expect(patternsByName.has('wood-block')).toBe(true);
  });

  it('getPatternNames returns strings', () => {
    const names = getPatternNames();
    expect(names.length).toBeGreaterThanOrEqual(1);
    expect(names).toContain('wood-block');
  });

  it('each pattern has required fields', () => {
    for (const p of patternRegistry) {
      expect(typeof p.name).toBe('string');
      expect(typeof p.displayName).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(typeof p.generate).toBe('function');
    }
  });

  it('patterns with paramDefs have valid definitions', () => {
    for (const p of patternRegistry) {
      if (!p.paramDefs) continue;
      for (const def of p.paramDefs) {
        expect(typeof def.key).toBe('string');
        expect(typeof def.label).toBe('string');
        expect(['slider', 'select', 'toggle']).toContain(def.type);
        expect(typeof def.defaultValue).toBe('number');
        if (def.type === 'slider') {
          expect(def.defaultValue).toBeGreaterThanOrEqual(def.min);
          expect(def.defaultValue).toBeLessThanOrEqual(def.max);
        }
        if (def.type === 'select') {
          const validValues = def.options.map((o) => o.value);
          expect(validValues).toContain(def.defaultValue);
        }
      }
    }
  });
});

describe('getParam', () => {
  const testDefs: ParamDef[] = [
    { key: 'size', label: 'Size', type: 'slider', min: 1, max: 100, step: 1, defaultValue: 50 },
    { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 0, label: 'A' }, { value: 1, label: 'B' }], defaultValue: 0 },
  ];

  const baseOptions: PatternOptions = {
    width: 800, height: 800, rand: () => 0.5,
    colorScheme: { name: 'test', palette: ['#000', '#111', '#222', '#333', '#444', '#555', '#666', '#777'] },
    zoom: 1,
  };

  it('returns default when params is undefined', () => {
    expect(getParam(baseOptions, testDefs, 'size')).toBe(50);
  });

  it('returns default when key is missing from params', () => {
    const opts = { ...baseOptions, params: { other: 99 } };
    expect(getParam(opts, testDefs, 'size')).toBe(50);
  });

  it('returns overridden value when key exists in params', () => {
    const opts = { ...baseOptions, params: { size: 75 } };
    expect(getParam(opts, testDefs, 'size')).toBe(75);
  });

  it('throws for unknown key', () => {
    expect(() => getParam(baseOptions, testDefs, 'nonexistent')).toThrow('Unknown param key');
  });
});
