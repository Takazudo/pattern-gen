/**
 * Apply contrast and brightness adjustment to canvas pixels in-place.
 * Brightness is applied first (offset), then contrast (scale around midpoint).
 */
export function applyContrastBrightness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjust: { contrast: number; brightness: number },
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
      data[i + c] = Math.max(0, Math.min(255, Math.round(val)));
    }
    // Alpha channel (i+3) unchanged
  }

  ctx.putImageData(imageData, 0, 0);
}
