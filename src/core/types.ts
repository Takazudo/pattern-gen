import type { ColorScheme } from './color-schemes.js';

/**
 * Options passed to every pattern generator function.
 */
export interface PatternOptions {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Seeded PRNG function returning 0-1 */
  rand: () => number;
  /** Active color scheme */
  colorScheme: ColorScheme;
  /** Zoom factor (>1 = closer, <1 = farther) */
  zoom: number;
  /** Pattern-specific numeric parameters */
  params?: Record<string, number>;
}

/**
 * A pattern generator draws on a Canvas 2D context.
 */
export interface PatternGenerator {
  /** URL-safe slug name for CLI --type flag */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Short description */
  description: string;
  /** Draw the pattern onto the canvas context */
  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void;
}

/**
 * CLI-level options parsed from command-line arguments.
 */
export interface GenerateOptions {
  /** Text seed for deterministic generation */
  slug: string;
  /** Pattern type name */
  type: string;
  /** Output image size in pixels */
  size?: number;
  /** Zoom factor */
  zoom?: number;
  /** Override background color */
  bg?: string;
  /** Color scheme name or "random" */
  colorScheme?: string;
  /** Output file path */
  out?: string;
  /** Output directory */
  outDir?: string;
  /** Pattern-specific params as key=value pairs */
  params?: Record<string, number>;
}
