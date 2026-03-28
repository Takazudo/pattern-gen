import type { ProcessedImage, ThresholdOptions } from "./types.js";

/**
 * Apply threshold to the alpha mask and produce final ImageData.
 * Pixels with alpha < threshold become fully transparent.
 * This is a fast operation (no ML) that can run on every slider change.
 */
export function applyThreshold(
  processed: ProcessedImage,
  options: ThresholdOptions,
): ImageData {
  const { original, alphaMask, width, height } = processed;
  const { threshold } = options;

  // Create new ImageData from original pixels
  const result = new ImageData(
    new Uint8ClampedArray(original.data),
    width,
    height,
  );

  // Apply threshold to alpha channel
  for (let i = 0; i < alphaMask.length; i++) {
    const alpha = alphaMask[i];
    // Below threshold → fully transparent
    // Above threshold → use the ML-provided alpha
    result.data[i * 4 + 3] = alpha < threshold ? 0 : alpha;
  }

  return result;
}
