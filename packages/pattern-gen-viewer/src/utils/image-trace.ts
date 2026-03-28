import { ImageTracerBrowser } from "@image-tracer-ts/browser";

export interface ImageTraceOptions {
  /** How many colors to quantize to (2-64) */
  numberOfColors: number;
  /** Filter out tiny paths below this outline length (0-20) */
  minPathSegments: number;
  /** Pre-blur amount (0-5) */
  blurRadius: number;
  /** Edge detection threshold for blur (0-1000) */
  blurDelta: number;
  /** SVG stroke width (0-5) */
  strokeWidth: number;
  /** Line fitting tolerance (0-10) */
  lineErrorMargin: number;
  /** Curve fitting tolerance (0-10) */
  curveErrorMargin: number;
}

export const DEFAULT_TRACE_OPTIONS: ImageTraceOptions = {
  numberOfColors: 16,
  minPathSegments: 0,
  blurRadius: 0,
  blurDelta: 20,
  strokeWidth: 1,
  lineErrorMargin: 1,
  curveErrorMargin: 1,
};

export async function traceImageData(
  imageData: ImageData,
  options?: Partial<ImageTraceOptions>,
): Promise<string> {
  const { minPathSegments, ...rest } = { ...DEFAULT_TRACE_OPTIONS, ...options };

  return ImageTracerBrowser.fromImageData(imageData, {
    ...rest,
    minShapeOutline: minPathSegments,
  });
}
