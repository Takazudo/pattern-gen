import { rgbToHsl, hslToRgb } from './color-utils.js';

export interface HslAdjust {
  /** Hue shift: -180 to 180 */
  h?: number;
  /** Saturation shift: -100 to 100 */
  s?: number;
  /** Lightness shift: -100 to 100 */
  l?: number;
}

/**
 * Apply HSL adjustment to canvas pixels in-place.
 * Reads ImageData, converts each pixel RGB->HSL, applies offsets, converts back.
 */
export function applyHslAdjust(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjust: HslAdjust,
): void {
  const hShift = adjust.h ?? 0;
  const sShift = adjust.s ?? 0;
  const lShift = adjust.l ?? 0;

  if (hShift === 0 && sShift === 0 && lShift === 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // skip transparent pixels
    const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);

    // Apply shifts with wrapping/clamping
    let h = (hsl.h + hShift) % 360;
    if (h < 0) h += 360;
    const s = Math.max(0, Math.min(100, hsl.s + sShift));
    const l = Math.max(0, Math.min(100, hsl.l + lShift));

    const [r, g, b] = hslToRgb(h, s, l);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    // alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
}
