import type { GenerateOptions } from './types.js';

export interface OgpCropRegion {
  x: number;      // 0-1 fraction of canvas buffer width
  y: number;      // 0-1 fraction of canvas buffer height
  width: number;  // 0-1 fraction
  height: number; // 0-1 fraction
}

export interface OgpConfig {
  version: 1;
  slug: string;
  type: string;
  colorScheme: string;       // scheme NAME (not index)
  zoom: number;              // actual zoom factor
  translateX: number;        // fraction -1 to 1
  translateY: number;
  useTranslate: boolean;
  params: Record<string, number>;
  hsl: { h: number; s: number; l: number };
  crop: OgpCropRegion;
}

const FLOAT_EPSILON = 1e-9;

export function serializeOgpConfig(config: OgpConfig): string {
  return JSON.stringify(config, null, 2);
}

export function parseOgpConfig(json: string): OgpConfig {
  const raw = JSON.parse(json);

  if (raw.version !== 1) {
    throw new Error(`Unsupported OGP config version: ${raw.version}`);
  }

  if (typeof raw.slug !== 'string' || raw.slug.length === 0) {
    throw new Error('OGP config: slug must be a non-empty string');
  }

  if (typeof raw.type !== 'string' || raw.type.length === 0) {
    throw new Error('OGP config: type must be a non-empty string');
  }

  if (typeof raw.colorScheme !== 'string' || raw.colorScheme.length === 0) {
    throw new Error('OGP config: colorScheme must be a non-empty string');
  }

  if (typeof raw.zoom !== 'number' || raw.zoom <= 0) {
    throw new Error('OGP config: zoom must be a number greater than 0');
  }

  if (typeof raw.translateX !== 'number' || raw.translateX < -1 || raw.translateX > 1) {
    throw new Error('OGP config: translateX must be a number in [-1, 1]');
  }

  if (typeof raw.translateY !== 'number' || raw.translateY < -1 || raw.translateY > 1) {
    throw new Error('OGP config: translateY must be a number in [-1, 1]');
  }

  if (typeof raw.useTranslate !== 'boolean') {
    throw new Error('OGP config: useTranslate must be a boolean');
  }

  // params: default to {} if missing
  if (raw.params === undefined || raw.params === null) {
    raw.params = {};
  } else if (typeof raw.params !== 'object' || Array.isArray(raw.params)) {
    throw new Error('OGP config: params must be an object');
  } else {
    for (const [k, v] of Object.entries(raw.params)) {
      if (typeof v !== 'number') {
        throw new Error(`OGP config: params.${k} must be a number`);
      }
    }
  }

  // hsl validation
  if (!raw.hsl || typeof raw.hsl !== 'object') {
    throw new Error('OGP config: hsl must be an object with h, s, l');
  }
  if (typeof raw.hsl.h !== 'number' || raw.hsl.h < -180 || raw.hsl.h > 180) {
    throw new Error('OGP config: hsl.h must be a number in [-180, 180]');
  }
  if (typeof raw.hsl.s !== 'number' || raw.hsl.s < -100 || raw.hsl.s > 100) {
    throw new Error('OGP config: hsl.s must be a number in [-100, 100]');
  }
  if (typeof raw.hsl.l !== 'number' || raw.hsl.l < -100 || raw.hsl.l > 100) {
    throw new Error('OGP config: hsl.l must be a number in [-100, 100]');
  }

  // crop validation
  if (!raw.crop || typeof raw.crop !== 'object') {
    throw new Error('OGP config: crop must be an object with x, y, width, height');
  }
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (typeof raw.crop[key] !== 'number' || raw.crop[key] < 0 || raw.crop[key] > 1) {
      throw new Error(`OGP config: crop.${key} must be a number in [0, 1]`);
    }
  }
  if (raw.crop.x + raw.crop.width > 1 + FLOAT_EPSILON) {
    throw new Error('OGP config: crop.x + crop.width must be <= 1');
  }
  if (raw.crop.y + raw.crop.height > 1 + FLOAT_EPSILON) {
    throw new Error('OGP config: crop.y + crop.height must be <= 1');
  }

  return raw as OgpConfig;
}

export function ogpConfigToGenerateOptions(config: OgpConfig): GenerateOptions {
  return {
    slug: config.slug,
    type: config.type,
    colorScheme: config.colorScheme,
    zoom: config.zoom,
    translateX: config.translateX,
    translateY: config.translateY,
    params: config.params,
    hsl: config.hsl,
  };
}
