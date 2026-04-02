import type { LayerTransform } from '@takazudo/pattern-gen-core';

/* ── Constants ── */

export const MIN_LAYER_SIZE = 20;
export const SNAP_THRESHOLD = 10;

/* ── Grid / snap helpers ── */

export function getGridPositions(totalSize: number, divide: number): number[] {
  const positions = [0, totalSize];
  for (let i = 1; i < divide; i++) {
    positions.push(Math.round(totalSize * i / divide));
  }
  return positions.sort((a, b) => a - b);
}

export function snapToNearest(
  value: number,
  gridPositions: number[],
  threshold: number = SNAP_THRESHOLD,
): number {
  let best: number | null = null;
  let bestDist = threshold;
  for (const pos of gridPositions) {
    const dist = Math.abs(value - pos);
    if (dist < bestDist) {
      bestDist = dist;
      best = pos;
    }
  }
  return best ?? value;
}

export function snapTransform(
  t: LayerTransform,
  xPositions: number[],
  yPositions: number[],
  threshold: number = SNAP_THRESHOLD,
): { x: number; y: number } {
  let newX = t.x;
  let newY = t.y;

  // Snap X: check left edge, center, right edge
  const leftSnap = snapToNearest(t.x, xPositions, threshold);
  const centerXSnap = snapToNearest(t.x + t.width / 2, xPositions, threshold);
  const rightSnap = snapToNearest(t.x + t.width, xPositions, threshold);

  if (leftSnap !== t.x) {
    newX = leftSnap;
  } else if (centerXSnap !== t.x + t.width / 2) {
    newX = centerXSnap - t.width / 2;
  } else if (rightSnap !== t.x + t.width) {
    newX = rightSnap - t.width;
  }

  // Snap Y: check top edge, center, bottom edge
  const topSnap = snapToNearest(t.y, yPositions, threshold);
  const centerYSnap = snapToNearest(t.y + t.height / 2, yPositions, threshold);
  const bottomSnap = snapToNearest(t.y + t.height, yPositions, threshold);

  if (topSnap !== t.y) {
    newY = topSnap;
  } else if (centerYSnap !== t.y + t.height / 2) {
    newY = centerYSnap - t.height / 2;
  } else if (bottomSnap !== t.y + t.height) {
    newY = bottomSnap - t.height;
  }

  return { x: newX, y: newY };
}
