import type { RemoveBackgroundOptions, ProcessedImage } from "./types.js";
import type { WorkerRequest, WorkerResponse } from "./bg-removal-worker.js";

let worker: Worker | null = null;
let idCounter = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("./bg-removal-worker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return worker;
}

export function removeBackgroundViaWorker(
  imageSource: Blob | File,
  options?: RemoveBackgroundOptions,
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const id = String(++idCounter);
    const w = getWorker();

    const onMessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;

      switch (msg.type) {
        case "progress":
          options?.onProgress?.(msg.progress);
          break;
        case "result": {
          w.removeEventListener("message", onMessage);
          w.removeEventListener("error", onError);
          const original = new ImageData(
            new Uint8ClampedArray(msg.originalBuffer),
            msg.width,
            msg.height,
          );
          resolve({
            original,
            alphaMask: new Uint8ClampedArray(msg.alphaMaskBuffer),
            width: msg.width,
            height: msg.height,
          });
          break;
        }
        case "error":
          w.removeEventListener("message", onMessage);
          w.removeEventListener("error", onError);
          reject(new Error(msg.message));
          break;
      }
    };

    const onError = (e: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      reject(new Error(e.message || "Worker error"));
    };

    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);

    // Convert Blob/File to ArrayBuffer and send with transfer
    imageSource.arrayBuffer().then((buffer) => {
      const mimeType = imageSource.type || "image/png";
      w.postMessage(
        { type: "process", id, buffer, mimeType } satisfies WorkerRequest,
        [buffer],
      );
    }).catch(reject);
  });
}
