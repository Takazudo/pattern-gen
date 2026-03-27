import { describe, it, expect } from 'vitest';
import { getAspect, getOutputDimensions } from '../src/core/aspect-config.js';
import type { AspectConfig } from '../src/core/aspect-config.js';
import { OGP_WIDTH, OGP_HEIGHT } from '../src/core/ogp-config.js';

function makeConfig(overrides: Partial<AspectConfig> = {}): AspectConfig {
  return {
    mode: 'ogp',
    freeW: 16,
    freeH: 9,
    fixedW: 800,
    fixedH: 600,
    ...overrides,
  };
}

describe('getAspect', () => {
  it('returns OGP aspect for ogp mode', () => {
    expect(getAspect(makeConfig({ mode: 'ogp' }))).toBeCloseTo(OGP_WIDTH / OGP_HEIGHT);
  });

  it('returns 1 for square mode', () => {
    expect(getAspect(makeConfig({ mode: 'square' }))).toBe(1);
  });

  it('returns freeW/freeH for free mode', () => {
    expect(getAspect(makeConfig({ mode: 'free', freeW: 16, freeH: 9 }))).toBeCloseTo(16 / 9);
  });

  it('returns fixedW/fixedH for fixed mode', () => {
    expect(getAspect(makeConfig({ mode: 'fixed', fixedW: 800, fixedH: 600 }))).toBeCloseTo(800 / 600);
  });
});

describe('getOutputDimensions', () => {
  it('returns OGP_WIDTH x OGP_HEIGHT for ogp mode', () => {
    const dims = getOutputDimensions(makeConfig({ mode: 'ogp' }));
    expect(dims).toEqual({ width: OGP_WIDTH, height: OGP_HEIGHT });
  });

  it('returns exact pixel dimensions for fixed mode', () => {
    const dims = getOutputDimensions(makeConfig({ mode: 'fixed', fixedW: 800, fixedH: 600 }));
    expect(dims).toEqual({ width: 800, height: 600 });
  });

  it('returns 1200x1200 for square mode', () => {
    const dims = getOutputDimensions(makeConfig({ mode: 'square' }));
    expect(dims).toEqual({ width: 1200, height: 1200 });
  });

  it('uses 1200 as width for landscape free ratio (16:9)', () => {
    const dims = getOutputDimensions(makeConfig({ mode: 'free', freeW: 16, freeH: 9 }));
    expect(dims.width).toBe(1200);
    expect(dims.height).toBe(Math.round(1200 / (16 / 9)));
  });

  it('uses 1200 as height for portrait free ratio (9:16)', () => {
    const dims = getOutputDimensions(makeConfig({ mode: 'free', freeW: 9, freeH: 16 }));
    expect(dims.height).toBe(1200);
    expect(dims.width).toBe(Math.round(1200 * (9 / 16)));
  });

  it('uses 1200 as width for landscape fixed ratio (1920:1080)', () => {
    // fixed mode returns exact pixels, not base-dimension scaled
    const dims = getOutputDimensions(makeConfig({ mode: 'fixed', fixedW: 1920, fixedH: 1080 }));
    expect(dims).toEqual({ width: 1920, height: 1080 });
  });

  it('maintains aspect ratio for all modes', () => {
    const modes: AspectConfig[] = [
      makeConfig({ mode: 'ogp' }),
      makeConfig({ mode: 'square' }),
      makeConfig({ mode: 'free', freeW: 4, freeH: 3 }),
      makeConfig({ mode: 'free', freeW: 3, freeH: 4 }),
      makeConfig({ mode: 'fixed', fixedW: 500, fixedH: 300 }),
    ];
    for (const config of modes) {
      const dims = getOutputDimensions(config);
      const expectedAspect = getAspect(config);
      expect(dims.width / dims.height).toBeCloseTo(expectedAspect, 1);
    }
  });
});
