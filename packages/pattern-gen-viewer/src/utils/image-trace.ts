import { ImageTracerBrowser } from '@image-tracer-ts/browser';
import { flattenAlpha, DEFAULT_TRACE_OPTIONS } from './image-trace-utils.js';
import type { ImageTraceOptions } from './image-trace-utils.js';

export { flattenAlpha, DEFAULT_TRACE_OPTIONS };
export type { ImageTraceOptions };

export async function traceImageData(
  imageData: ImageData,
  options?: Partial<ImageTraceOptions>,
): Promise<string> {
  const merged = { ...DEFAULT_TRACE_OPTIONS, ...options };
  const opaqueData = flattenAlpha(imageData);
  const svgString = await ImageTracerBrowser.fromImageData(opaqueData, {
    numberOfColors: merged.numberOfColors,
    minShapeOutline: merged.minPathSegments,
    blurRadius: merged.blurRadius,
    blurDelta: merged.blurDelta,
    strokeWidth: merged.strokeWidth,
    lineErrorMargin: merged.lineErrorMargin,
    curveErrorMargin: merged.curveErrorMargin,
    // Emit explicit width/height attributes instead of viewBox-only.
    // viewBox-only SVGs have no intrinsic dimensions, causing layout
    // collapse when rendered inline inside flex containers.
    viewBox: false,
  });
  return svgString;
}
