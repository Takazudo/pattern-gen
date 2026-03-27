/**
 * Shared utilities for frame renderers.
 */

/**
 * Convert hex color (#RRGGBB or #RRGGBBAA) to rgba() string for Canvas.
 */
export function hexToRgba(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Parse hex alpha value (0-1) from #RRGGBBAA format.
 */
export function hexAlpha(hex: string): number {
  return hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
}
