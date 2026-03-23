import { describe, it, expect } from 'vitest';
import { randomizeDefaults } from '../src/core/randomize-defaults.js';
import { createRandom } from '../src/core/seeded-random.js';
import type { ParamDef, PatternOptions } from '../src/core/types.js';

const testDefs: ParamDef[] = [
  { key: 'size', label: 'Size', type: 'slider', min: 10, max: 100, step: 1, defaultValue: 50 },
  { key: 'density', label: 'Density', type: 'slider', min: 0.1, max: 1.0, step: 0.1, defaultValue: 0.5 },
  { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 0, label: 'A' }, { value: 1, label: 'B' }], defaultValue: 0 },
];

const baseOptions: PatternOptions = {
  width: 800,
  height: 800,
  rand: createRandom(42),
  colorScheme: { name: 'test', palette: ['#000', '#111', '#222', '#333', '#444', '#555', '#666', '#777'] },
  zoom: 1,
};

describe('randomizeDefaults', () => {
  it('generates random values for specified slider keys when not set', () => {
    const rand = createRandom(42);
    const result = randomizeDefaults(baseOptions, testDefs, rand, ['size', 'density']);
    expect(result.params).toBeDefined();
    expect(result.params!.size).toBeGreaterThanOrEqual(10);
    expect(result.params!.size).toBeLessThanOrEqual(100);
    expect(result.params!.density).toBeGreaterThanOrEqual(0.1);
    expect(result.params!.density).toBeLessThanOrEqual(1.0);
  });

  it('does not overwrite explicitly set params', () => {
    const rand = createRandom(42);
    const opts = { ...baseOptions, params: { size: 75 } };
    const result = randomizeDefaults(opts, testDefs, rand, ['size', 'density']);
    expect(result.params!.size).toBe(75);
    expect(result.params!.density).toBeGreaterThanOrEqual(0.1);
  });

  it('skips non-slider params (select/toggle)', () => {
    const rand = createRandom(42);
    const result = randomizeDefaults(baseOptions, testDefs, rand, ['mode']);
    // mode is a select, should not be randomized — options unchanged
    expect(result).toBe(baseOptions);
  });

  it('returns original options when no params need randomization', () => {
    const rand = createRandom(42);
    const opts = { ...baseOptions, params: { size: 75, density: 0.8 } };
    const result = randomizeDefaults(opts, testDefs, rand, ['size', 'density']);
    expect(result).toBe(opts);
  });

  it('is deterministic with the same seed', () => {
    const rand1 = createRandom(99);
    const rand2 = createRandom(99);
    const result1 = randomizeDefaults(baseOptions, testDefs, rand1, ['size', 'density']);
    const result2 = randomizeDefaults(baseOptions, testDefs, rand2, ['size', 'density']);
    expect(result1.params!.size).toBe(result2.params!.size);
    expect(result1.params!.density).toBe(result2.params!.density);
  });

  it('produces different values for different seeds', () => {
    const rand1 = createRandom(1);
    const rand2 = createRandom(2);
    const result1 = randomizeDefaults(baseOptions, testDefs, rand1, ['size']);
    const result2 = randomizeDefaults(baseOptions, testDefs, rand2, ['size']);
    expect(result1.params!.size).not.toBe(result2.params!.size);
  });
});
