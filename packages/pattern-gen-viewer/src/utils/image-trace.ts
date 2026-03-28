import { ImageTracerBrowser } from '@image-tracer-ts/browser';

export interface ImageTraceOptions {
  numberOfColors: number;
  minPathSegments: number;
  blurRadius: number;
  blurDelta: number;
  strokeWidth: number;
  lineErrorMargin: number;
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
  const merged = { ...DEFAULT_TRACE_OPTIONS, ...options };
  const svgString = await ImageTracerBrowser.fromImageData(imageData, {
    numberOfColors: merged.numberOfColors,
    minShapeOutline: merged.minPathSegments,
    blurRadius: merged.blurRadius,
    blurDelta: merged.blurDelta,
    strokeWidth: merged.strokeWidth,
    lineErrorMargin: merged.lineErrorMargin,
    curveErrorMargin: merged.curveErrorMargin,
  });
  return svgString;
}
