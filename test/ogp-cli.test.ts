import { describe, it, expect } from 'vitest';
import { renderOgpFromConfig } from '../src/renderer.js';
import type { OgpConfig } from '@takazudo/pattern-gen-core';

function makeValidOgpConfig(): OgpConfig {
  return {
    version: 1,
    slug: 'testslug123',
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

describe('renderOgpFromConfig', () => {
  it('produces a 1200x630 PNG', async () => {
    const config = makeValidOgpConfig();
    const result = await renderOgpFromConfig(config);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    // Verify PNG signature
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50); // P
    expect(result.buffer[2]).toBe(0x4e); // N
    expect(result.buffer[3]).toBe(0x47); // G
  });

  it('renders with useTranslate enabled', async () => {
    const config = makeValidOgpConfig();
    config.useTranslate = true;
    config.translateX = 0.1;
    config.translateY = -0.2;
    const result = await renderOgpFromConfig(config);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it('produces identical output for same config', async () => {
    const config = makeValidOgpConfig();
    const result1 = await renderOgpFromConfig(config);
    const result2 = await renderOgpFromConfig(config);
    expect(result1.buffer.equals(result2.buffer)).toBe(true);
  });

  it('throws for unknown pattern type', async () => {
    const config = makeValidOgpConfig();
    config.type = 'nonexistent-pattern';
    await expect(renderOgpFromConfig(config)).rejects.toThrow('Unknown pattern type');
  });

  it('throws for unknown color scheme', async () => {
    const config = makeValidOgpConfig();
    config.colorScheme = 'NonexistentScheme';
    await expect(renderOgpFromConfig(config)).rejects.toThrow('Unknown color scheme');
  });

  it('different crops produce different outputs', async () => {
    const config1 = makeValidOgpConfig();
    config1.crop = { x: 0, y: 0, width: 0.5, height: 0.2625 };
    const config2 = makeValidOgpConfig();
    config2.crop = { x: 0.5, y: 0.5, width: 0.5, height: 0.2625 };
    const result1 = await renderOgpFromConfig(config1);
    const result2 = await renderOgpFromConfig(config2);
    expect(result1.buffer.equals(result2.buffer)).toBe(false);
  });
});
