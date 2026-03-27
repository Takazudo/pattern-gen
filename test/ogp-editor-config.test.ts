import { describe, it, expect } from 'vitest';
import {
  serializeOgpEditorConfig,
  parseOgpEditorConfig,
} from '../src/core/ogp-editor-config.js';
import type {
  OgpEditorConfig,
  ImageLayerData,
  TextLayerData,
} from '../src/core/ogp-editor-config.js';
import type { OgpConfig } from '../src/core/ogp-config.js';

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

function makeValidEditorConfig(): OgpEditorConfig {
  return {
    version: 1,
    background: makeValidBackground(),
    layers: [makeImageLayer(), makeTextLayer()],
  };
}

describe('serializeOgpEditorConfig / parseOgpEditorConfig', () => {
  it('round-trip: serialize then parse returns deep-equal config', () => {
    const config = makeValidEditorConfig();
    const json = serializeOgpEditorConfig(config);
    const parsed = parseOgpEditorConfig(json);
    expect(parsed).toEqual(config);
  });
});

describe('parseOgpEditorConfig validation', () => {
  it('throws on unsupported version', () => {
    const config = { ...makeValidEditorConfig(), version: 2 };
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'Unsupported OGP editor config version: 2',
    );
  });

  it('validates background (delegates to parseOgpConfig)', () => {
    const config = makeValidEditorConfig();
    (config.background as Record<string, unknown>).slug = '';
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'slug must be a non-empty string',
    );
  });

  it('throws on image layer with missing src', () => {
    const config = makeValidEditorConfig();
    const layer = config.layers[0] as Record<string, unknown>;
    layer.src = '';
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'src must be a non-empty string',
    );
  });

  it('throws on image layer with invalid opacity', () => {
    const config = makeValidEditorConfig();
    const layer = config.layers[0] as Record<string, unknown>;
    layer.opacity = 1.5;
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'opacity must be a number in [0, 1]',
    );
  });

  it('throws on text layer with invalid fontSize', () => {
    const config = makeValidEditorConfig();
    const layer = config.layers[1] as Record<string, unknown>;
    layer.fontSize = -10;
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'fontSize must be a positive finite number',
    );
  });

  it('throws on text layer with invalid fontWeight', () => {
    const config = makeValidEditorConfig();
    const layer = config.layers[1] as Record<string, unknown>;
    layer.fontWeight = 'bolder';
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'fontWeight must be "normal" or "bold"',
    );
  });

  it('throws on transform with negative width', () => {
    const config = makeValidEditorConfig();
    (config.layers[0] as Record<string, unknown>).transform = {
      x: 0,
      y: 0,
      width: -100,
      height: 50,
    };
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'transform.width must be a positive finite number',
    );
  });

  it('accepts empty layers array', () => {
    const config = makeValidEditorConfig();
    config.layers = [];
    const json = JSON.stringify(config);
    const parsed = parseOgpEditorConfig(json);
    expect(parsed.layers).toEqual([]);
  });

  it('defaults textVAlign to top when omitted (backward compat)', () => {
    const config = makeValidEditorConfig();
    const raw = JSON.parse(JSON.stringify(config));
    // Remove textVAlign from the text layer
    delete raw.layers[1].textVAlign;
    const parsed = parseOgpEditorConfig(JSON.stringify(raw));
    const textLayer = parsed.layers[1] as TextLayerData;
    expect(textLayer.textVAlign).toBe('top');
  });

  it('throws on text layer with invalid textVAlign', () => {
    const config = makeValidEditorConfig();
    const layer = config.layers[1] as Record<string, unknown>;
    layer.textVAlign = 'center';
    const json = JSON.stringify(config);
    expect(() => parseOgpEditorConfig(json)).toThrow(
      'textVAlign must be "top", "middle", or "bottom"',
    );
  });

  it('parses config with frame field', () => {
    const config = {
      ...makeValidEditorConfig(),
      frame: { type: 'simple-line', params: { borderWidth: 10, color: '#ff0000' } },
    };
    const json = JSON.stringify(config);
    const parsed = parseOgpEditorConfig(json);
    expect(parsed.frame).toEqual({ type: 'simple-line', params: { borderWidth: 10, color: '#ff0000' } });
  });

  it('parses config without frame field (undefined)', () => {
    const config = makeValidEditorConfig();
    const json = JSON.stringify(config);
    const parsed = parseOgpEditorConfig(json);
    expect(parsed.frame).toBeUndefined();
  });

  it('round-trips config with frame', () => {
    const config: OgpEditorConfig = {
      ...makeValidEditorConfig(),
      frame: { type: 'neon-glow', params: { glowColor: '#00ffff', glowRadius: 15 } },
    };
    const json = serializeOgpEditorConfig(config);
    const parsed = parseOgpEditorConfig(json);
    expect(parsed.frame).toEqual(config.frame);
  });
});
