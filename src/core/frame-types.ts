/**
 * Options passed to every frame renderer.
 */
export interface FrameRenderOptions {
  /** Canvas width in pixels (1200 for OGP) */
  width: number;
  /** Canvas height in pixels (630 for OGP) */
  height: number;
  /** Seeded PRNG function returning 0-1 (for deterministic frames) */
  rand: () => number;
}

/**
 * Discriminated union for frame parameter definitions.
 */
export type FrameParamDef =
  | SliderFrameParam
  | ColorFrameParam
  | SelectFrameParam
  | ToggleFrameParam;

interface FrameParamBase {
  /** Machine-readable key */
  key: string;
  /** Human-readable label for UI */
  label: string;
}

export interface SliderFrameParam extends FrameParamBase {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface ColorFrameParam extends FrameParamBase {
  type: 'color';
  /** Default color in hex (#RRGGBB or #RRGGBBAA) */
  defaultValue: string;
}

export interface SelectFrameParam extends FrameParamBase {
  type: 'select';
  options: { value: number; label: string }[];
  defaultValue: number;
}

export interface ToggleFrameParam extends FrameParamBase {
  type: 'toggle';
  /** 0 = off, 1 = on */
  defaultValue: 0 | 1;
}

/**
 * A frame generator draws a decorative border on a Canvas 2D context.
 * The frame is drawn AFTER background and layers (on top of everything).
 */
export interface FrameGenerator {
  /** URL-safe slug name */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Short description */
  description: string;
  /** Parameter definitions for the UI */
  paramDefs: FrameParamDef[];
  /** Draw the frame onto the canvas context */
  render(
    ctx: CanvasRenderingContext2D,
    options: FrameRenderOptions,
    params: Record<string, number | string>,
  ): void;
}
