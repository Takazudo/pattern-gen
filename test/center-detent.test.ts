import { describe, it, expect } from 'vitest';
import { centerDetentToZoom, zoomToCenterDetent } from '../src/core/center-detent.js';

describe('centerDetentToZoom', () => {
  it('maps slider=50 to zoom=1 (center/detent)', () => {
    expect(centerDetentToZoom(50)).toBe(1);
  });

  it('maps slider=0 to zoom=0.2 (max zoom out)', () => {
    expect(centerDetentToZoom(0)).toBeCloseTo(0.2, 5);
  });

  it('maps slider=100 to zoom=5 (max zoom in)', () => {
    expect(centerDetentToZoom(100)).toBeCloseTo(5, 5);
  });

  it('returns values < 1 for slider < 50', () => {
    expect(centerDetentToZoom(25)).toBeLessThan(1);
    expect(centerDetentToZoom(25)).toBeGreaterThan(0.2);
  });

  it('returns values > 1 for slider > 50', () => {
    expect(centerDetentToZoom(75)).toBeGreaterThan(1);
    expect(centerDetentToZoom(75)).toBeLessThan(5);
  });

  it('is monotonically increasing', () => {
    let prev = centerDetentToZoom(0);
    for (let i = 1; i <= 100; i++) {
      const curr = centerDetentToZoom(i);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });
});

describe('zoomToCenterDetent', () => {
  it('maps zoom=1 to slider=50', () => {
    expect(zoomToCenterDetent(1)).toBeCloseTo(50, 5);
  });

  it('maps zoom=0.2 to slider=0', () => {
    expect(zoomToCenterDetent(0.2)).toBeCloseTo(0, 5);
  });

  it('maps zoom=5 to slider=100', () => {
    expect(zoomToCenterDetent(5)).toBeCloseTo(100, 5);
  });
});

describe('round-trip', () => {
  it('zoomToCenterDetent(centerDetentToZoom(x)) ≈ x', () => {
    for (let x = 0; x <= 100; x += 5) {
      const roundTrip = zoomToCenterDetent(centerDetentToZoom(x));
      expect(roundTrip).toBeCloseTo(x, 5);
    }
  });

  it('centerDetentToZoom(zoomToCenterDetent(z)) ≈ z', () => {
    const zooms = [0.2, 0.5, 1, 2, 3, 5];
    for (const z of zooms) {
      const roundTrip = centerDetentToZoom(zoomToCenterDetent(z));
      expect(roundTrip).toBeCloseTo(z, 5);
    }
  });
});
