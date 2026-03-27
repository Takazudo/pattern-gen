/**
 * Maps a 0–100 slider value to a zoom factor using an exponential curve
 * centered at slider=50 → zoom=1 (the "detent" position).
 *
 * - slider=0   → zoom=0.2 (maximum zoom out)
 * - slider=50  → zoom=1   (neutral / detent)
 * - slider=100 → zoom=5   (maximum zoom in)
 */

const MAX_ZOOM = 5;
// base^50 = MAX_ZOOM, so base = MAX_ZOOM^(1/50)
const BASE = Math.pow(MAX_ZOOM, 1 / 50);

/**
 * Convert a slider value (0–100) to a zoom factor.
 * Uses an exponential curve so zoom feels natural on both sides of center.
 */
export function centerDetentToZoom(sliderValue: number): number {
  return Math.pow(BASE, sliderValue - 50);
}

/**
 * Inverse of centerDetentToZoom: convert a zoom factor back to a slider value (0–100).
 */
export function zoomToCenterDetent(zoom: number): number {
  return Math.log(zoom) / Math.log(BASE) + 50;
}
