import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

// In a Web Worker, postMessage accepts (message, transfer[]) but the DOM lib
// only knows the Window overload. This helper provides the correct signature.
const workerPostMessage: (msg: unknown, transfer?: Transferable[]) => void =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).postMessage.bind(self);

export interface WorkerRequest {
  type: "process";
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
}

export interface WorkerProgressMessage {
  type: "progress";
  id: string;
  progress: number;
}

export interface WorkerResultMessage {
  type: "result";
  id: string;
  originalBuffer: ArrayBuffer;
  alphaMaskBuffer: ArrayBuffer;
  width: number;
  height: number;
}

export interface WorkerErrorMessage {
  type: "error";
  id: string;
  message: string;
}

export type WorkerResponse =
  | WorkerProgressMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, id, buffer, mimeType } = e.data;
  if (type !== "process") return;

  try {
    // Reconstruct Blob from transferred ArrayBuffer
    const blob = new Blob([buffer], { type: mimeType });

    // Run ML background removal
    const resultBlob = await imglyRemoveBackground(blob, {
      progress: (_key: string, current: number, total: number) => {
        workerPostMessage({
          type: "progress",
          id,
          progress: total > 0 ? Math.min(1, current / total) : 0,
        } satisfies WorkerProgressMessage);
      },
    });

    // Convert result blob to pixels using OffscreenCanvas
    const bitmap = await createImageBitmap(resultBlob);
    const { width, height } = bitmap;

    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const resultImageData = ctx.getImageData(0, 0, width, height);

      // Extract alpha channel as the soft mask
      const alphaMask = new Uint8ClampedArray(width * height);
      for (let i = 0; i < alphaMask.length; i++) {
        alphaMask[i] = resultImageData.data[i * 4 + 3];
      }

      // Load original image data at the same dimensions as the ML output
      const origCanvas = new OffscreenCanvas(width, height);
      const origCtx = origCanvas.getContext("2d")!;
      const origBitmap = await createImageBitmap(blob);
      let originalBuffer: ArrayBuffer;
      try {
        origCtx.drawImage(origBitmap, 0, 0, width, height);
        const originalImageData = origCtx.getImageData(0, 0, width, height);
        originalBuffer = originalImageData.data.buffer;
      } finally {
        origBitmap.close();
      }

      const alphaMaskBuffer = alphaMask.buffer;

      workerPostMessage(
        {
          type: "result",
          id,
          originalBuffer,
          alphaMaskBuffer,
          width,
          height,
        } satisfies WorkerResultMessage,
        [originalBuffer, alphaMaskBuffer],
      );
    } finally {
      bitmap.close();
    }
  } catch (err) {
    workerPostMessage({
      type: "error",
      id,
      message: err instanceof Error ? err.message : "Background removal failed",
    } satisfies WorkerErrorMessage);
  }
};
