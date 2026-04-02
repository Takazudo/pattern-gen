import { describe, it, expect } from 'vitest';
import {
  getGridPositions,
  snapToNearest,
  snapTransform,
  SNAP_THRESHOLD,
} from '../packages/pattern-gen-viewer/src/components/composer-grid-utils.js';

describe('getGridPositions', () => {
  it('returns [0, totalSize] when divide is 1', () => {
    expect(getGridPositions(1200, 1)).toEqual([0, 1200]);
  });

  it('returns sorted positions for divide=2', () => {
    expect(getGridPositions(1200, 2)).toEqual([0, 600, 1200]);
  });

  it('returns sorted positions for divide=3', () => {
    expect(getGridPositions(900, 3)).toEqual([0, 300, 600, 900]);
  });

  it('rounds fractional positions', () => {
    const positions = getGridPositions(100, 3);
    // 100/3 ≈ 33.33, 200/3 ≈ 66.67
    expect(positions).toEqual([0, 33, 67, 100]);
  });
});

describe('snapToNearest', () => {
  const grid = [0, 300, 600, 900, 1200];

  it('snaps to nearest grid position within threshold', () => {
    expect(snapToNearest(295, grid)).toBe(300);
    expect(snapToNearest(305, grid)).toBe(300);
  });

  it('returns original value when beyond threshold', () => {
    expect(snapToNearest(150, grid)).toBe(150);
  });

  it('snaps to closest when equidistant is not exact', () => {
    // 5 is within default threshold (10) of 0
    expect(snapToNearest(5, grid)).toBe(0);
  });

  it('respects custom threshold', () => {
    expect(snapToNearest(295, grid, 3)).toBe(295); // 5 > 3
    expect(snapToNearest(298, grid, 3)).toBe(300); // 2 < 3
  });
});

describe('snapTransform', () => {
  const xGrid = [0, 600, 1200];
  const yGrid = [0, 315, 630];

  it('snaps left edge to grid', () => {
    const t = { x: 595, y: 100, width: 200, height: 100 };
    const result = snapTransform(t, xGrid, yGrid);
    expect(result.x).toBe(600);
    expect(result.y).toBe(100);
  });

  it('snaps top edge to grid', () => {
    const t = { x: 100, y: 312, width: 200, height: 100 };
    const result = snapTransform(t, xGrid, yGrid);
    expect(result.x).toBe(100);
    expect(result.y).toBe(315);
  });

  it('snaps center to grid when edges are far', () => {
    // center X = 100 + 400/2 = 300 — not near any grid line
    // right = 100 + 400 = 500 — not near any grid line
    // So x stays at 100
    const t = { x: 100, y: 100, width: 400, height: 200 };
    const result = snapTransform(t, xGrid, yGrid);
    expect(result.x).toBe(100);
  });

  it('snaps right edge to grid', () => {
    // right = 1005 + 200 = 1205, near 1200
    const t = { x: 1005, y: 100, width: 200, height: 100 };
    const result = snapTransform(t, xGrid, yGrid);
    // left edge 1005 not near grid, center 1105 not near grid, right 1205 near 1200
    expect(result.x).toBe(1000); // 1200 - 200
  });

  it('returns original position when no edge is within threshold', () => {
    const t = { x: 150, y: 150, width: 100, height: 100 };
    const result = snapTransform(t, xGrid, yGrid);
    expect(result.x).toBe(150);
    expect(result.y).toBe(150);
  });

  it('respects custom threshold', () => {
    const t = { x: 595, y: 100, width: 200, height: 100 };
    const result = snapTransform(t, xGrid, yGrid, 3);
    // 595 is 5 away from 600, beyond threshold of 3
    expect(result.x).toBe(595);
  });
});
