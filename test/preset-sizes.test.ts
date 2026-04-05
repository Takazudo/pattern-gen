import { describe, it, expect } from 'vitest';
import {
  PRESET_SIZES,
  PRESET_SIZE_CATEGORIES,
} from '@takazudo/pattern-gen-core';
import type { PresetSize } from '@takazudo/pattern-gen-core';

describe('PRESET_SIZES', () => {
  it('contains at least 15 presets', () => {
    expect(PRESET_SIZES.length).toBeGreaterThanOrEqual(15);
  });

  it('has unique IDs', () => {
    const ids = PRESET_SIZES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has positive width and height', () => {
    for (const preset of PRESET_SIZES) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
  });

  it('every preset has a non-empty platform and label', () => {
    for (const preset of PRESET_SIZES) {
      expect(preset.platform.length).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it('every preset category is valid', () => {
    const validCategories = PRESET_SIZE_CATEGORIES.map((c) => c.id);
    for (const preset of PRESET_SIZES) {
      expect(validCategories).toContain(preset.category);
    }
  });

  it('contains well-known presets', () => {
    const byId = (id: string): PresetSize | undefined =>
      PRESET_SIZES.find((p) => p.id === id);

    const yt = byId('youtube-thumbnail');
    expect(yt).toBeDefined();
    expect(yt!.width).toBe(1280);
    expect(yt!.height).toBe(720);

    const ogp = byId('ogp');
    expect(ogp).toBeDefined();
    expect(ogp!.width).toBe(1200);
    expect(ogp!.height).toBe(630);

    const igSquare = byId('instagram-square');
    expect(igSquare).toBeDefined();
    expect(igSquare!.width).toBe(1080);
    expect(igSquare!.height).toBe(1080);
  });
});

describe('PRESET_SIZE_CATEGORIES', () => {
  it('contains expected categories', () => {
    const ids = PRESET_SIZE_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('social');
    expect(ids).toContain('video');
    expect(ids).toContain('web');
  });

  it('every category has presets', () => {
    for (const cat of PRESET_SIZE_CATEGORIES) {
      const items = PRESET_SIZES.filter((p) => p.category === cat.id);
      expect(items.length).toBeGreaterThan(0);
    }
  });
});
