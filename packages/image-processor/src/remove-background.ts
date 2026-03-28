import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";
import type { RemoveBackgroundOptions, ProcessedImage } from "./types.js";

export async function removeBackground(
  imageSource: Blob | File,
  options?: RemoveBackgroundOptions,
): Promise<ProcessedImage> {
  // Run ML background removal
  const onProgress = options?.onProgress;
  const resultBlob = await imglyRemoveBackground(imageSource, {
    progress: onProgress
      ? (_key: string, current: number, total: number) => {
          onProgress(total > 0 ? Math.min(1, current / total) : 0);
        }
      : undefined,
  });

  // Convert result blob to ImageData to extract alpha mask
  const bitmap = await createImageBitmap(resultBlob);
  const { width, height } = bitmap;

  let alphaMask: Uint8ClampedArray;
  let originalImageData: ImageData;

  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const resultImageData = ctx.getImageData(0, 0, width, height);

    // Extract alpha channel as the soft mask
    alphaMask = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alphaMask.length; i++) {
      alphaMask[i] = resultImageData.data[i * 4 + 3]; // Alpha channel
    }

    // Also load original image data at the same dimensions as the ML output
    const origCanvas = new OffscreenCanvas(width, height);
    const origCtx = origCanvas.getContext("2d")!;
    const origBitmap = await createImageBitmap(imageSource);
    try {
      origCtx.drawImage(origBitmap, 0, 0, width, height);
      originalImageData = origCtx.getImageData(0, 0, width, height);
    } finally {
      origBitmap.close();
    }
  } finally {
    bitmap.close();
  }

  return {
    original: originalImageData,
    alphaMask,
    width,
    height,
  };
}
