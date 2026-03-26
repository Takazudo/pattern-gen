import { describe, it, expect } from 'vitest';
import {
  serializeOgpConfig,
  parseOgpConfig,
  ogpConfigToGenerateOptions,
} from '../src/core/ogp-config.js';
import type { OgpConfig } from '../src/core/ogp-config.js';

function makeValidConfig(): OgpConfig {
  return {
    version: 1,
    slug: 'my-test-slug',
    type: 'wood-block',
    colorScheme: 'Nord',
    zoom: 1.5,
    translateX: 0.2,
    translateY: -0.3,
    useTranslate: true,
    params: { size: 50, density: 0.8 },
    hsl: { h: 10, s: -20, l: 5 },
    crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 },
  };
}

describe('serializeOgpConfig / parseOgpConfig', () => {
  it('round-trip: serialize then parse returns deep-equal config', () => {
    const config = makeValidConfig();
    const json = serializeOgpConfig(config);
    const parsed = parseOgpConfig(json);
    expect(parsed).toEqual(config);
  });
});

describe('parseOgpConfig validation', () => {
  it('throws on unsupported version', () => {
    const config = { ...makeValidConfig(), version: 2 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('Unsupported OGP config version: 2');
  });

  it('throws on missing slug', () => {
    const config = makeValidConfig() as Record<string, unknown>;
    delete config.slug;
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('slug must be a non-empty string');
  });

  it('throws on empty slug', () => {
    const config = { ...makeValidConfig(), slug: '' };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('slug must be a non-empty string');
  });

  it('throws on zoom = 0', () => {
    const config = { ...makeValidConfig(), zoom: 0 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('zoom must be a finite number greater than 0');
  });

  it('throws on negative zoom', () => {
    const config = { ...makeValidConfig(), zoom: -1 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('zoom must be a finite number greater than 0');
  });

  it('throws on translateX out of range', () => {
    const config = { ...makeValidConfig(), translateX: 2 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('translateX must be a finite number in [-1, 1]');
  });

  it('throws on translateY out of range', () => {
    const config = { ...makeValidConfig(), translateY: -1.5 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('translateY must be a finite number in [-1, 1]');
  });

  it('throws when crop.x + crop.width > 1', () => {
    const config = makeValidConfig();
    config.crop = { x: 0.6, y: 0, width: 0.5, height: 0.5 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('crop.x + crop.width must be <= 1');
  });

  it('throws when crop.y + crop.height > 1', () => {
    const config = makeValidConfig();
    config.crop = { x: 0, y: 0.7, width: 0.5, height: 0.5 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('crop.y + crop.height must be <= 1');
  });

  it('throws on negative crop dimension', () => {
    const config = makeValidConfig();
    config.crop = { x: 0.1, y: 0.1, width: -0.5, height: 0.5 };
    const json = JSON.stringify(config);
    expect(() => parseOgpConfig(json)).toThrow('crop.width must be a finite number in [0, 1]');
  });

  it('defaults missing params to {}', () => {
    const config = makeValidConfig() as Record<string, unknown>;
    delete config.params;
    const json = JSON.stringify(config);
    const parsed = parseOgpConfig(json);
    expect(parsed.params).toEqual({});
  });

  it('throws when params contains a non-number value', () => {
    const json = JSON.stringify({ ...makeValidConfig(), params: { size: 'big' } });
    expect(() => parseOgpConfig(json)).toThrow('params.size must be a number');
  });
});

describe('ogpConfigToGenerateOptions', () => {
  it('maps all fields correctly', () => {
    const config = makeValidConfig();
    const opts = ogpConfigToGenerateOptions(config);
    expect(opts).toEqual({
      slug: 'my-test-slug',
      type: 'wood-block',
      colorScheme: 'Nord',
      zoom: 1.5,
      translateX: 0.2,
      translateY: -0.3,
      params: { size: 50, density: 0.8 },
      hsl: { h: 10, s: -20, l: 5 },
    });
  });

  it('does not include crop or useTranslate', () => {
    const config = makeValidConfig();
    const opts = ogpConfigToGenerateOptions(config);
    expect(opts).not.toHaveProperty('crop');
    expect(opts).not.toHaveProperty('useTranslate');
    expect(opts).not.toHaveProperty('version');
  });
});
