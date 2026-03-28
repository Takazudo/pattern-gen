export interface RemoveBackgroundOptions {
  /** Progress callback (0-1) during model loading/inference */
  onProgress?: (progress: number) => void;
}

export interface ProcessedImage {
  /** The original image as ImageData */
  original: ImageData;
  /** The soft alpha mask from ML removal (values 0-255 per pixel) */
  alphaMask: Uint8ClampedArray;
  /** Width of the image */
  width: number;
  /** Height of the image */
  height: number;
}

export interface ThresholdOptions {
  /** Threshold value 0-255. Pixels with alpha < threshold become fully transparent. Default: 0 (no effect) */
  threshold: number;
}
