import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";
import type { RemoveBackgroundOptions, ProcessedImage } from "./types.js";

export async function removeBackground(
  imageSource: Blob | File,
  options?: RemoveBackgroundOptions,
): Promise<ProcessedImage> {
  // Run ML background removal
  const resultBlob = await imglyRemoveBackground(imageSource, {
    progress: options?.onProgress
      ? (key: string, current: number, total: number) => {
          options.onProgress!(total > 0 ? current / total : 0);
        }
      : undefined,
  });

  // Convert result blob to ImageData to extract alpha mask
  const bitmap = await createImageBitmap(resultBlob);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const resultImageData = ctx.getImageData(0, 0, width, height);

  // Extract alpha channel as the soft mask
  const alphaMask = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alphaMask.length; i++) {
    alphaMask[i] = resultImageData.data[i * 4 + 3]; // Alpha channel
  }

  // Also load original image data
  const origCanvas = new OffscreenCanvas(width, height);
  const origCtx = origCanvas.getContext("2d")!;
  const origBitmap = await createImageBitmap(imageSource);
  origCtx.drawImage(origBitmap, 0, 0, width, height);
  const originalImageData = origCtx.getImageData(0, 0, width, height);

  bitmap.close();
  origBitmap.close();

  return {
    original: originalImageData,
    alphaMask,
    width,
    height,
  };
}
