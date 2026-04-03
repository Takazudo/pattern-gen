/** Contrast and brightness adjustment values (-100 to 100). */
export interface ContrastBrightness {
  contrast: number;
  brightness: number;
}

/**
 * Apply contrast and brightness adjustment to canvas pixels in-place.
 * Brightness is applied first (offset), then contrast (scale around midpoint).
 */
export function applyContrastBrightness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjust: ContrastBrightness,
): void {
  if (adjust.contrast === 0 && adjust.brightness === 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const brightnessOffset = (adjust.brightness * 255) / 100;
  const contrastFactor = (100 + adjust.contrast) / 100;

  for (let i = 0; i < data.length; i += 4) {
    // Apply brightness first, then contrast
    for (let c = 0; c < 3; c++) {
      let val = data[i + c] + brightnessOffset;
      val = (val - 128) * contrastFactor + 128;
      // Uint8ClampedArray auto-clamps but Math.round is needed for correct rounding
      data[i + c] = Math.round(val);
    }
    // Alpha channel (i+3) unchanged
  }

  ctx.putImageData(imageData, 0, 0);
}
