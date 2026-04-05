import type { OgpConfig } from './ogp-config.js';
import { parseOgpConfig } from './ogp-config.js';

export interface LayerTransform {
  x: number; // px in 1200x630 space
  y: number;
  width: number;
  height: number;
}

export interface LayerFilters {
  blur?: number; // 0-20 px
  brightness?: number; // 0-200 (percent, default 100 = no change)
  contrast?: number; // 0-200 (percent, default 100 = no change)
  saturate?: number; // 0-200 (percent, default 100 = no change)
  hueRotate?: number; // 0-360 degrees
  grayscale?: number; // 0-100 percent
  sepia?: number; // 0-100 percent
  invert?: number; // 0-100 percent
}

export const DEFAULT_LAYER_FILTERS: Required<LayerFilters> = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
};

/** Fill in defaults for any missing filter properties */
export function normalizeLayerFilters(
  filters?: LayerFilters,
): Required<LayerFilters> {
  return { ...DEFAULT_LAYER_FILTERS, ...filters };
}

/** Build a CSS filter string from layer filters. Returns 'none' if all defaults. */
export function buildFilterString(filters?: LayerFilters): string {
  if (!filters) return 'none';
  const f = normalizeLayerFilters(filters);
  const parts: string[] = [];
  if (f.blur !== 0) parts.push(`blur(${f.blur}px)`);
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.hueRotate !== 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  if (f.grayscale !== 0) parts.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia !== 0) parts.push(`sepia(${f.sepia}%)`);
  if (f.invert !== 0) parts.push(`invert(${f.invert}%)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

export interface ImageLayerData {
  type: 'image';
  name: string;
  src: string; // URL or data URI
  transform: LayerTransform;
  opacity: number; // 0-1
  filters?: LayerFilters;
  bgRemoval?: {
    enabled: boolean;
    threshold: number; // 0-255
  };
}

export interface TextLayerData {
  type: 'text';
  name: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  opacity: number;
  textAlign: 'left' | 'center' | 'right';
  textVAlign: 'top' | 'middle' | 'bottom';
  letterSpacing: number;
  lineHeight: number;
  shadow: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
  stroke: { enabled: boolean; color: string; width: number };
  transform: LayerTransform;
  filters?: LayerFilters;
}

export type EditorLayer = ImageLayerData | TextLayerData;

export interface FrameConfig {
  type: string; // frame generator name (slug)
  params: Record<string, number | string>;
}

export interface CropRect {
  x: number; // fraction 0-1 of outputWidth
  y: number; // fraction 0-1 of outputHeight
  width: number; // fraction 0-1 of outputWidth
  height: number; // fraction 0-1 of outputHeight
}

export interface ComposerConfig {
  version: 1;
  background: OgpConfig;
  layers: EditorLayer[];
  frame?: FrameConfig;
  crop?: CropRect;
}

export function serializeComposerConfig(config: ComposerConfig): string {
  return JSON.stringify(config, null, 2);
}

function validateTransform(t: unknown, label: string): LayerTransform {
  if (!t || typeof t !== 'object') {
    throw new Error(`${label}: transform must be an object`);
  }
  const raw = t as Record<string, unknown>;
  if (typeof raw.x !== 'number' || !Number.isFinite(raw.x)) {
    throw new Error(`${label}: transform.x must be a finite number`);
  }
  if (typeof raw.y !== 'number' || !Number.isFinite(raw.y)) {
    throw new Error(`${label}: transform.y must be a finite number`);
  }
  if (
    typeof raw.width !== 'number' ||
    !Number.isFinite(raw.width) ||
    raw.width <= 0
  ) {
    throw new Error(`${label}: transform.width must be a positive finite number`);
  }
  if (
    typeof raw.height !== 'number' ||
    !Number.isFinite(raw.height) ||
    raw.height <= 0
  ) {
    throw new Error(
      `${label}: transform.height must be a positive finite number`,
    );
  }
  return { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function validateLayerFilters(
  raw: unknown,
  label: string,
): LayerFilters | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object') {
    throw new Error(`${label}: filters must be an object`);
  }
  const f = raw as Record<string, unknown>;
  const result: LayerFilters = {};

  if (f.blur != null) {
    if (typeof f.blur !== 'number' || !Number.isFinite(f.blur))
      throw new Error(`${label}: filters.blur must be a finite number`);
    result.blur = clamp(f.blur, 0, 20);
  }
  if (f.brightness != null) {
    if (typeof f.brightness !== 'number' || !Number.isFinite(f.brightness))
      throw new Error(
        `${label}: filters.brightness must be a finite number`,
      );
    result.brightness = clamp(f.brightness, 0, 200);
  }
  if (f.contrast != null) {
    if (typeof f.contrast !== 'number' || !Number.isFinite(f.contrast))
      throw new Error(`${label}: filters.contrast must be a finite number`);
    result.contrast = clamp(f.contrast, 0, 200);
  }
  if (f.saturate != null) {
    if (typeof f.saturate !== 'number' || !Number.isFinite(f.saturate))
      throw new Error(`${label}: filters.saturate must be a finite number`);
    result.saturate = clamp(f.saturate, 0, 200);
  }
  if (f.hueRotate != null) {
    if (typeof f.hueRotate !== 'number' || !Number.isFinite(f.hueRotate))
      throw new Error(
        `${label}: filters.hueRotate must be a finite number`,
      );
    result.hueRotate = clamp(f.hueRotate, 0, 360);
  }
  if (f.grayscale != null) {
    if (typeof f.grayscale !== 'number' || !Number.isFinite(f.grayscale))
      throw new Error(
        `${label}: filters.grayscale must be a finite number`,
      );
    result.grayscale = clamp(f.grayscale, 0, 100);
  }
  if (f.sepia != null) {
    if (typeof f.sepia !== 'number' || !Number.isFinite(f.sepia))
      throw new Error(`${label}: filters.sepia must be a finite number`);
    result.sepia = clamp(f.sepia, 0, 100);
  }
  if (f.invert != null) {
    if (typeof f.invert !== 'number' || !Number.isFinite(f.invert))
      throw new Error(`${label}: filters.invert must be a finite number`);
    result.invert = clamp(f.invert, 0, 100);
  }

  // Return undefined if all defaults (sparse storage)
  if (Object.keys(result).length === 0) return undefined;
  return result;
}

function validateImageLayer(raw: Record<string, unknown>): ImageLayerData {
  const label = `Image layer "${raw.name ?? ''}"`;
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new Error(`Image layer: name must be a non-empty string`);
  }
  if (typeof raw.src !== 'string' || raw.src.length === 0) {
    throw new Error(`${label}: src must be a non-empty string`);
  }
  if (
    typeof raw.opacity !== 'number' ||
    !Number.isFinite(raw.opacity) ||
    raw.opacity < 0 ||
    raw.opacity > 1
  ) {
    throw new Error(`${label}: opacity must be a number in [0, 1]`);
  }
  const transform = validateTransform(raw.transform, label);
  const filters = validateLayerFilters(raw.filters, label);
  return {
    type: 'image',
    name: raw.name,
    src: raw.src,
    transform,
    opacity: raw.opacity,
    ...(filters ? { filters } : {}),
  };
}

function validateTextLayer(raw: Record<string, unknown>): TextLayerData {
  const label = `Text layer "${raw.name ?? ''}"`;
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new Error(`Text layer: name must be a non-empty string`);
  }
  if (typeof raw.content !== 'string') {
    throw new Error(`${label}: content must be a string`);
  }
  if (typeof raw.fontFamily !== 'string' || raw.fontFamily.length === 0) {
    throw new Error(`${label}: fontFamily must be a non-empty string`);
  }
  if (
    typeof raw.fontSize !== 'number' ||
    !Number.isFinite(raw.fontSize) ||
    raw.fontSize <= 0
  ) {
    throw new Error(`${label}: fontSize must be a positive finite number`);
  }
  if (raw.fontWeight !== 'normal' && raw.fontWeight !== 'bold') {
    throw new Error(`${label}: fontWeight must be "normal" or "bold"`);
  }
  if (raw.fontStyle !== 'normal' && raw.fontStyle !== 'italic') {
    throw new Error(`${label}: fontStyle must be "normal" or "italic"`);
  }
  if (typeof raw.color !== 'string' || raw.color.length === 0) {
    throw new Error(`${label}: color must be a non-empty string`);
  }
  if (
    typeof raw.opacity !== 'number' ||
    !Number.isFinite(raw.opacity) ||
    raw.opacity < 0 ||
    raw.opacity > 1
  ) {
    throw new Error(`${label}: opacity must be a number in [0, 1]`);
  }
  if (
    raw.textAlign !== 'left' &&
    raw.textAlign !== 'center' &&
    raw.textAlign !== 'right'
  ) {
    throw new Error(`${label}: textAlign must be "left", "center", or "right"`);
  }
  // Default textVAlign to 'top' for backwards compat
  const textVAlign = raw.textVAlign == null ? 'top' : raw.textVAlign;
  if (
    textVAlign !== 'top' &&
    textVAlign !== 'middle' &&
    textVAlign !== 'bottom'
  ) {
    throw new Error(
      `${label}: textVAlign must be "top", "middle", or "bottom"`,
    );
  }
  if (
    typeof raw.letterSpacing !== 'number' ||
    !Number.isFinite(raw.letterSpacing)
  ) {
    throw new Error(`${label}: letterSpacing must be a finite number`);
  }
  if (
    typeof raw.lineHeight !== 'number' ||
    !Number.isFinite(raw.lineHeight) ||
    raw.lineHeight <= 0
  ) {
    throw new Error(`${label}: lineHeight must be a positive finite number`);
  }

  // Validate shadow
  const shadow = raw.shadow as Record<string, unknown> | undefined;
  if (!shadow || typeof shadow !== 'object') {
    throw new Error(`${label}: shadow must be an object`);
  }
  if (typeof shadow.enabled !== 'boolean') {
    throw new Error(`${label}: shadow.enabled must be a boolean`);
  }
  if (typeof shadow.offsetX !== 'number' || !Number.isFinite(shadow.offsetX)) {
    throw new Error(`${label}: shadow.offsetX must be a finite number`);
  }
  if (typeof shadow.offsetY !== 'number' || !Number.isFinite(shadow.offsetY)) {
    throw new Error(`${label}: shadow.offsetY must be a finite number`);
  }
  if (
    typeof shadow.blur !== 'number' ||
    !Number.isFinite(shadow.blur) ||
    shadow.blur < 0
  ) {
    throw new Error(`${label}: shadow.blur must be a non-negative finite number`);
  }
  if (typeof shadow.color !== 'string' || shadow.color.length === 0) {
    throw new Error(`${label}: shadow.color must be a non-empty string`);
  }

  // Validate stroke
  const stroke = raw.stroke as Record<string, unknown> | undefined;
  if (!stroke || typeof stroke !== 'object') {
    throw new Error(`${label}: stroke must be an object`);
  }
  if (typeof stroke.enabled !== 'boolean') {
    throw new Error(`${label}: stroke.enabled must be a boolean`);
  }
  if (typeof stroke.color !== 'string' || stroke.color.length === 0) {
    throw new Error(`${label}: stroke.color must be a non-empty string`);
  }
  if (
    typeof stroke.width !== 'number' ||
    !Number.isFinite(stroke.width) ||
    stroke.width < 0
  ) {
    throw new Error(`${label}: stroke.width must be a non-negative finite number`);
  }

  const transform = validateTransform(raw.transform, label);
  const filters = validateLayerFilters(raw.filters, label);

  return {
    type: 'text',
    name: raw.name as string,
    content: raw.content as string,
    fontFamily: raw.fontFamily as string,
    fontSize: raw.fontSize as number,
    fontWeight: raw.fontWeight as 'normal' | 'bold',
    fontStyle: raw.fontStyle as 'normal' | 'italic',
    color: raw.color as string,
    opacity: raw.opacity as number,
    textAlign: raw.textAlign as 'left' | 'center' | 'right',
    textVAlign: textVAlign as 'top' | 'middle' | 'bottom',
    letterSpacing: raw.letterSpacing as number,
    lineHeight: raw.lineHeight as number,
    shadow: {
      enabled: shadow.enabled as boolean,
      offsetX: shadow.offsetX as number,
      offsetY: shadow.offsetY as number,
      blur: shadow.blur as number,
      color: shadow.color as string,
    },
    stroke: {
      enabled: stroke.enabled as boolean,
      color: stroke.color as string,
      width: stroke.width as number,
    },
    transform,
    ...(filters ? { filters } : {}),
  };
}

export function parseComposerConfig(json: string): ComposerConfig {
  const raw = JSON.parse(json);

  if (raw.version !== 1) {
    throw new Error(`Unsupported Composer config version: ${raw.version}`);
  }

  // Validate background via parseOgpConfig
  const background = parseOgpConfig(JSON.stringify(raw.background));

  if (!Array.isArray(raw.layers)) {
    throw new Error('Composer config: layers must be an array');
  }

  const layers: EditorLayer[] = raw.layers.map(
    (layer: Record<string, unknown>) => {
      if (layer.type === 'image') {
        return validateImageLayer(layer);
      }
      if (layer.type === 'text') {
        return validateTextLayer(layer);
      }
      throw new Error(
        `Composer config: unknown layer type "${layer.type}"`,
      );
    },
  );

  // Validate optional frame
  let frame: FrameConfig | undefined;
  if (raw.frame != null) {
    if (typeof raw.frame !== 'object' || Array.isArray(raw.frame)) {
      throw new Error('Composer config: frame must be an object');
    }
    const f = raw.frame as Record<string, unknown>;
    if (typeof f.type !== 'string' || f.type.length === 0) {
      throw new Error('Composer config: frame.type must be a non-empty string');
    }
    if (f.params != null && (typeof f.params !== 'object' || Array.isArray(f.params))) {
      throw new Error('Composer config: frame.params must be an object');
    }
    frame = {
      type: f.type,
      params: (f.params as Record<string, number | string>) ?? {},
    };
  }

  // Validate optional crop
  let crop: CropRect | undefined;
  if (raw.crop != null) {
    if (typeof raw.crop !== 'object' || Array.isArray(raw.crop)) {
      throw new Error('Composer config: crop must be an object');
    }
    const c = raw.crop as Record<string, unknown>;
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      if (typeof c[key] !== 'number' || !Number.isFinite(c[key] as number)) {
        throw new Error(`Composer config: crop.${key} must be a finite number`);
      }
    }
    const cx = c.x as number;
    const cy = c.y as number;
    const cw = c.width as number;
    const ch = c.height as number;
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1 || cw <= 0 || cw > 1 || ch <= 0 || ch > 1) {
      throw new Error('Composer config: crop values must be fractions in [0, 1]');
    }
    if (cx + cw > 1 || cy + ch > 1) {
      throw new Error('Composer config: crop region extends beyond canvas bounds');
    }
    crop = { x: cx, y: cy, width: cw, height: ch };
  }

  return {
    version: 1 as const,
    background,
    layers,
    ...(frame ? { frame } : {}),
    ...(crop ? { crop } : {}),
  };
}
