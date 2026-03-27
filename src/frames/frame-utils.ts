/**
 * Shared utilities for frame renderers.
 */

/**
 * Convert hex color (#RRGGBB or #RRGGBBAA) to rgba() string for Canvas.
 */
export function hexToRgba(hex: string): string {
  if (!hex || hex[0] !== '#' || (hex.length !== 7 && hex.length !== 9)) {
    return 'rgba(0, 0, 0, 1)';
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 'rgba(0, 0, 0, 1)';
  const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${isNaN(a) ? 1 : a})`;
}

/**
 * Parse hex alpha value (0-1) from #RRGGBBAA format.
 */
export function hexAlpha(hex: string): number {
  return hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
}

/**
 * Reset canvas shadow state to avoid shadow leaking to subsequent draw calls.
 */
export function resetShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}
