import { describe, it, expect } from 'vitest';
import {
  computeAlignment,
} from '../packages/pattern-gen-viewer/src/components/composer-align-utils.js';
import type { LayerTransform } from '@takazudo/pattern-gen-core';

function makeLayers(transforms: [string, LayerTransform][]) {
  return transforms.map(([id, transform]) => ({ id, transform }));
}

describe('computeAlignment', () => {
  const layerA: [string, LayerTransform] = ['a', { x: 10, y: 20, width: 100, height: 50 }];
  const layerB: [string, LayerTransform] = ['b', { x: 50, y: 80, width: 200, height: 60 }];
  const layerC: [string, LayerTransform] = ['c', { x: 30, y: 40, width: 150, height: 80 }];

  it('returns null when fewer than 2 targets are selected', () => {
    const layers = makeLayers([layerA, layerB]);
    expect(computeAlignment(layers, ['a'], 'align-left')).toBeNull();
  });

  it('returns null when no targets match selection', () => {
    const layers = makeLayers([layerA, layerB]);
    expect(computeAlignment(layers, ['x', 'y'], 'align-left')).toBeNull();
  });

  describe('align-left', () => {
    it('aligns all layers to leftmost x', () => {
      const layers = makeLayers([layerA, layerB, layerC]);
      const result = computeAlignment(layers, ['a', 'b', 'c'], 'align-left')!;
      expect(result.get('a')!.x).toBe(10);
      expect(result.get('b')!.x).toBe(10);
      expect(result.get('c')!.x).toBe(10);
    });
  });

  describe('align-right', () => {
    it('aligns all layers to rightmost edge', () => {
      const layers = makeLayers([layerA, layerB]);
      // maxRight = max(10+100, 50+200) = max(110, 250) = 250
      const result = computeAlignment(layers, ['a', 'b'], 'align-right')!;
      expect(result.get('a')!.x).toBe(150); // 250 - 100
      expect(result.get('b')!.x).toBe(50);  // 250 - 200
    });
  });

  describe('align-center-h', () => {
    it('aligns all layers to horizontal center', () => {
      const layers = makeLayers([layerA, layerB]);
      // minX=10, maxRight=250, centerX=130
      const result = computeAlignment(layers, ['a', 'b'], 'align-center-h')!;
      expect(result.get('a')!.x).toBe(80);  // 130 - 100/2
      expect(result.get('b')!.x).toBe(30);  // 130 - 200/2
    });
  });

  describe('align-top', () => {
    it('aligns all layers to topmost y', () => {
      const layers = makeLayers([layerA, layerB, layerC]);
      const result = computeAlignment(layers, ['a', 'b', 'c'], 'align-top')!;
      expect(result.get('a')!.y).toBe(20);
      expect(result.get('b')!.y).toBe(20);
      expect(result.get('c')!.y).toBe(20);
    });
  });

  describe('align-bottom', () => {
    it('aligns all layers to bottommost edge', () => {
      const layers = makeLayers([layerA, layerB]);
      // maxBottom = max(20+50, 80+60) = max(70, 140) = 140
      const result = computeAlignment(layers, ['a', 'b'], 'align-bottom')!;
      expect(result.get('a')!.y).toBe(90);  // 140 - 50
      expect(result.get('b')!.y).toBe(80);  // 140 - 60
    });
  });

  describe('align-middle-v', () => {
    it('aligns all layers to vertical center', () => {
      const layers = makeLayers([layerA, layerB]);
      // minY=20, maxBottom=140, centerY=80
      const result = computeAlignment(layers, ['a', 'b'], 'align-middle-v')!;
      expect(result.get('a')!.y).toBe(55);  // 80 - 50/2
      expect(result.get('b')!.y).toBe(50);  // 80 - 60/2
    });
  });

  it('does not modify non-selected layers in the result map', () => {
    const layers = makeLayers([layerA, layerB, layerC]);
    const result = computeAlignment(layers, ['a', 'b'], 'align-left')!;
    expect(result.has('c')).toBe(false);
  });

  it('preserves width and height in aligned transforms', () => {
    const layers = makeLayers([layerA, layerB]);
    const result = computeAlignment(layers, ['a', 'b'], 'align-left')!;
    expect(result.get('a')!.width).toBe(100);
    expect(result.get('a')!.height).toBe(50);
    expect(result.get('b')!.width).toBe(200);
    expect(result.get('b')!.height).toBe(60);
  });
});
