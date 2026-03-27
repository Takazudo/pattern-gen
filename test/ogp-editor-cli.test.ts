import { describe, it, expect } from 'vitest';
import { renderOgpEditorFromConfig } from '../src/renderer.js';
import type { OgpEditorConfig, TextLayerData, OgpConfig } from '@takazudo/pattern-gen-core';

function makeValidBackground(): OgpConfig {
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

function makeTextLayer(): TextLayerData {
  return {
    type: 'text',
    name: 'title',
    content: 'Hello Test',
    fontFamily: 'sans-serif',
    fontSize: 48,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#ffffff',
    opacity: 1,
    textAlign: 'left',
    letterSpacing: 0,
    lineHeight: 1.2,
    shadow: {
      enabled: false,
      offsetX: 0,
      offsetY: 0,
      blur: 0,
      color: 'rgba(0,0,0,0)',
    },
    stroke: { enabled: false, color: '#000000', width: 0 },
    transform: { x: 100, y: 200, width: 1000, height: 200 },
  };
}

describe('renderOgpEditorFromConfig', () => {
  it('produces a 1200x630 PNG with empty layers (background only)', async () => {
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [],
    };
    const result = await renderOgpEditorFromConfig(config);
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

  it('produces valid PNG with text layer', async () => {
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [makeTextLayer()],
    };
    const result = await renderOgpEditorFromConfig(config);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.buffer[0]).toBe(0x89);
    expect(result.buffer[1]).toBe(0x50);
  });

  it('produces identical output for same config (deterministic)', async () => {
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [],
    };
    const result1 = await renderOgpEditorFromConfig(config);
    const result2 = await renderOgpEditorFromConfig(config);
    expect(result1.buffer.equals(result2.buffer)).toBe(true);
  });

  it('produces valid PNG with frame config', async () => {
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [],
      frame: { type: 'simple-line', params: { borderWidth: 10, color: '#ff0000' } },
    };
    const result = await renderOgpEditorFromConfig(config);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
    expect(result.buffer[0]).toBe(0x89); // PNG signature
    expect(result.buffer[1]).toBe(0x50);
    // Output should differ from frameless version
    const noFrame: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [],
    };
    const noFrameResult = await renderOgpEditorFromConfig(noFrame);
    expect(result.buffer.equals(noFrameResult.buffer)).toBe(false);
  });

  it('ignores unknown frame type gracefully', async () => {
    const config: OgpEditorConfig = {
      version: 1,
      background: makeValidBackground(),
      layers: [],
      frame: { type: 'nonexistent-frame', params: {} },
    };
    // Should not throw — unknown frame is silently skipped
    const result = await renderOgpEditorFromConfig(config);
    expect(result.buffer[0]).toBe(0x89);
  });

  it('throws for unknown pattern type in background', async () => {
    const config: OgpEditorConfig = {
      version: 1,
      background: { ...makeValidBackground(), type: 'nonexistent-pattern' },
      layers: [],
    };
    await expect(renderOgpEditorFromConfig(config)).rejects.toThrow(
      'Unknown pattern type',
    );
  });
});
