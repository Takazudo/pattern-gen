import { ImageTracerBrowser } from '@image-tracer-ts/browser';

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

/**
 * Composite every pixel onto a white background so fully/partially
 * transparent pixels become opaque. This prevents the tracer library
 * from discarding low-alpha pixels (threshold < 13/255) which would
 * otherwise contaminate the palette with invisible colors.
 */
export function flattenAlpha(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const out = new ImageData(width, height);
  const dst = out.data;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    // Composite over white (255, 255, 255)
    dst[i] = Math.round(data[i] * a + 255 * (1 - a)); // R
    dst[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a)); // G
    dst[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a)); // B
    dst[i + 3] = 255; // fully opaque
  }
  return out;
}

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
  });
  return svgString;
}
