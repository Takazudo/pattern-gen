import { describe, it, expect } from 'vitest';
import {
  serializeComposerConfig,
  parseComposerConfig,
} from '@takazudo/pattern-gen-core';
import type {
  ComposerConfig,
  ImageLayerData,
  TextLayerData,
  OgpConfig,
} from '@takazudo/pattern-gen-core';

function makeValidBackground(): OgpConfig {
  return {
    version: 1,
    slug: 'test-slug',
    type: 'wood-block',
    colorScheme: 'Nord',
    zoom: 1,
    translateX: 0,
    translateY: 0,
    useTranslate: false,
    params: {},
    hsl: { h: 0, s: 0, l: 0 },
    crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.42 },
  };
}

function makeImageLayer(): ImageLayerData {
  return {
    type: 'image',
    name: 'logo',
    src: 'https://example.com/logo.png',
    transform: { x: 100, y: 50, width: 200, height: 100 },
    opacity: 0.9,
  };
}

function makeTextLayer(): TextLayerData {
  return {
    type: 'text',
    name: 'title',
    content: 'Hello World',
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#ffffff',
    opacity: 1,
    textAlign: 'center',
    textVAlign: 'top',
    letterSpacing: 0,
    lineHeight: 1.2,
    shadow: {
      enabled: true,
      offsetX: 2,
      offsetY: 2,
      blur: 4,
      color: 'rgba(0,0,0,0.5)',
    },
    stroke: { enabled: false, color: '#000000', width: 0 },
    transform: { x: 100, y: 200, width: 1000, height: 200 },
  };
}

function makeValidComposerConfig(): ComposerConfig {
  return {
    version: 1,
    background: makeValidBackground(),
    layers: [makeImageLayer(), makeTextLayer()],
  };
}

describe('serializeComposerConfig / parseComposerConfig', () => {
  it('round-trip: serialize then parse returns deep-equal config', () => {
    const config = makeValidComposerConfig();
    const json = serializeComposerConfig(config);
    const parsed = parseComposerConfig(json);
    expect(parsed).toEqual(config);
  });
});

describe('parseComposerConfig validation', () => {
  it('throws on unsupported version', () => {
    const config = { ...makeValidComposerConfig(), version: 2 };
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'Unsupported Composer config version: 2',
    );
  });

  it('validates background (delegates to parseOgpConfig)', () => {
    const config = makeValidComposerConfig();
    (config.background as Record<string, unknown>).slug = '';
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'slug must be a non-empty string',
    );
  });

  it('throws on image layer with missing src', () => {
    const config = makeValidComposerConfig();
    const layer = config.layers[0] as Record<string, unknown>;
    layer.src = '';
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'src must be a non-empty string',
    );
  });

  it('throws on image layer with invalid opacity', () => {
    const config = makeValidComposerConfig();
    const layer = config.layers[0] as Record<string, unknown>;
    layer.opacity = 1.5;
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'opacity must be a number in [0, 1]',
    );
  });

  it('throws on text layer with invalid fontSize', () => {
    const config = makeValidComposerConfig();
    const layer = config.layers[1] as Record<string, unknown>;
    layer.fontSize = -10;
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'fontSize must be a positive finite number',
    );
  });

  it('throws on text layer with invalid fontWeight', () => {
    const config = makeValidComposerConfig();
    const layer = config.layers[1] as Record<string, unknown>;
    layer.fontWeight = 'bolder';
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'fontWeight must be "normal" or "bold"',
    );
  });

  it('throws on transform with negative width', () => {
    const config = makeValidComposerConfig();
    (config.layers[0] as Record<string, unknown>).transform = {
      x: 0,
      y: 0,
      width: -100,
      height: 50,
    };
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'transform.width must be a positive finite number',
    );
  });

  it('accepts empty layers array', () => {
    const config = makeValidComposerConfig();
    config.layers = [];
    const json = JSON.stringify(config);
    const parsed = parseComposerConfig(json);
    expect(parsed.layers).toEqual([]);
  });

  it('defaults textVAlign to top when omitted (backward compat)', () => {
    const config = makeValidComposerConfig();
    const raw = JSON.parse(JSON.stringify(config));
    // Remove textVAlign from the text layer
    delete raw.layers[1].textVAlign;
    const parsed = parseComposerConfig(JSON.stringify(raw));
    const textLayer = parsed.layers[1] as TextLayerData;
    expect(textLayer.textVAlign).toBe('top');
  });

  it('throws on text layer with invalid textVAlign', () => {
    const config = makeValidComposerConfig();
    const layer = config.layers[1] as Record<string, unknown>;
    layer.textVAlign = 'center';
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'textVAlign must be "top", "middle", or "bottom"',
    );
  });

  it('parses config with frame field', () => {
    const config = {
      ...makeValidComposerConfig(),
      frame: { type: 'simple-line', params: { borderWidth: 10, color: '#ff0000' } },
    };
    const json = JSON.stringify(config);
    const parsed = parseComposerConfig(json);
    expect(parsed.frame).toEqual({ type: 'simple-line', params: { borderWidth: 10, color: '#ff0000' } });
  });

  it('parses config without frame field (undefined)', () => {
    const config = makeValidComposerConfig();
    const json = JSON.stringify(config);
    const parsed = parseComposerConfig(json);
    expect(parsed.frame).toBeUndefined();
  });

  it('round-trips config with frame', () => {
    const config: ComposerConfig = {
      ...makeValidComposerConfig(),
      frame: { type: 'neon-glow', params: { glowColor: '#00ffff', glowRadius: 15 } },
    };
    const json = serializeComposerConfig(config);
    const parsed = parseComposerConfig(json);
    expect(parsed.frame).toEqual(config.frame);
  });

  it('parses config with crop field', () => {
    const config = {
      ...makeValidComposerConfig(),
      crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 },
    };
    const json = JSON.stringify(config);
    const parsed = parseComposerConfig(json);
    expect(parsed.crop).toEqual({ x: 0.1, y: 0.2, width: 0.6, height: 0.5 });
  });

  it('parses config without crop field (undefined)', () => {
    const config = makeValidComposerConfig();
    const json = JSON.stringify(config);
    const parsed = parseComposerConfig(json);
    expect(parsed.crop).toBeUndefined();
  });

  it('round-trips config with crop', () => {
    const config: ComposerConfig = {
      ...makeValidComposerConfig(),
      crop: { x: 0, y: 0.1, width: 1, height: 0.8 },
    };
    const json = serializeComposerConfig(config);
    const parsed = parseComposerConfig(json);
    expect(parsed.crop).toEqual(config.crop);
  });

  it('throws on crop with non-number field', () => {
    const config = {
      ...makeValidComposerConfig(),
      crop: { x: 'bad', y: 0, width: 1, height: 1 },
    };
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'crop.x must be a finite number',
    );
  });

  it('throws on crop with out-of-range values', () => {
    const config = {
      ...makeValidComposerConfig(),
      crop: { x: -0.1, y: 0, width: 1, height: 1 },
    };
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'crop values must be fractions in [0, 1]',
    );
  });

  it('throws on crop with zero width', () => {
    const config = {
      ...makeValidComposerConfig(),
      crop: { x: 0, y: 0, width: 0, height: 1 },
    };
    const json = JSON.stringify(config);
    expect(() => parseComposerConfig(json)).toThrow(
      'crop values must be fractions in [0, 1]',
    );
  });
});
