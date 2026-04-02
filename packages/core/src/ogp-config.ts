export const OGP_WIDTH = 1200;
export const OGP_HEIGHT = 630;

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
  rotate?: number;
  skewX?: number;
  skewY?: number;
  params: Record<string, number>;
  hsl: { h: number; s: number; l: number };
  contrastBrightness?: { contrast: number; brightness: number };
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

  if (typeof raw.zoom !== 'number' || !Number.isFinite(raw.zoom) || raw.zoom <= 0) {
    throw new Error('OGP config: zoom must be a finite number greater than 0');
  }

  if (typeof raw.translateX !== 'number' || !Number.isFinite(raw.translateX) || raw.translateX < -1 || raw.translateX > 1) {
    throw new Error('OGP config: translateX must be a finite number in [-1, 1]');
  }

  if (typeof raw.translateY !== 'number' || !Number.isFinite(raw.translateY) || raw.translateY < -1 || raw.translateY > 1) {
    throw new Error('OGP config: translateY must be a finite number in [-1, 1]');
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
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(`OGP config: params.${k} must be a finite number`);
      }
    }
  }

  // hsl validation
  if (!raw.hsl || typeof raw.hsl !== 'object') {
    throw new Error('OGP config: hsl must be an object with h, s, l');
  }
  if (typeof raw.hsl.h !== 'number' || !Number.isFinite(raw.hsl.h) || raw.hsl.h < -180 || raw.hsl.h > 180) {
    throw new Error('OGP config: hsl.h must be a finite number in [-180, 180]');
  }
  if (typeof raw.hsl.s !== 'number' || !Number.isFinite(raw.hsl.s) || raw.hsl.s < -100 || raw.hsl.s > 100) {
    throw new Error('OGP config: hsl.s must be a finite number in [-100, 100]');
  }
  if (typeof raw.hsl.l !== 'number' || !Number.isFinite(raw.hsl.l) || raw.hsl.l < -100 || raw.hsl.l > 100) {
    throw new Error('OGP config: hsl.l must be a finite number in [-100, 100]');
  }

  // contrastBrightness validation (optional, default {0,0})
  let contrastBrightness: { contrast: number; brightness: number } | undefined;
  if (raw.contrastBrightness != null) {
    if (typeof raw.contrastBrightness !== 'object') {
      throw new Error('OGP config: contrastBrightness must be an object with contrast, brightness');
    }
    const cb = raw.contrastBrightness;
    if (typeof cb.contrast !== 'number' || !Number.isFinite(cb.contrast) || cb.contrast < -100 || cb.contrast > 100) {
      throw new Error('OGP config: contrastBrightness.contrast must be a finite number in [-100, 100]');
    }
    if (typeof cb.brightness !== 'number' || !Number.isFinite(cb.brightness) || cb.brightness < -100 || cb.brightness > 100) {
      throw new Error('OGP config: contrastBrightness.brightness must be a finite number in [-100, 100]');
    }
    contrastBrightness = { contrast: cb.contrast, brightness: cb.brightness };
  }

  // crop validation
  if (!raw.crop || typeof raw.crop !== 'object') {
    throw new Error('OGP config: crop must be an object with x, y, width, height');
  }
  for (const key of ['x', 'y'] as const) {
    if (typeof raw.crop[key] !== 'number' || !Number.isFinite(raw.crop[key]) || raw.crop[key] < 0 || raw.crop[key] > 1) {
      throw new Error(`OGP config: crop.${key} must be a finite number in [0, 1]`);
    }
  }
  for (const key of ['width', 'height'] as const) {
    if (typeof raw.crop[key] !== 'number' || !Number.isFinite(raw.crop[key]) || raw.crop[key] <= 0 || raw.crop[key] > 1) {
      throw new Error(`OGP config: crop.${key} must be a finite number in (0, 1]`);
    }
  }
  if (raw.crop.x + raw.crop.width > 1 + FLOAT_EPSILON) {
    throw new Error('OGP config: crop.x + crop.width must be <= 1');
  }
  if (raw.crop.y + raw.crop.height > 1 + FLOAT_EPSILON) {
    throw new Error('OGP config: crop.y + crop.height must be <= 1');
  }

  // Optional rotate/skew fields (with range validation)
  let rotate: number | undefined;
  if (raw.rotate != null) {
    if (typeof raw.rotate !== 'number' || !Number.isFinite(raw.rotate) || raw.rotate < -180 || raw.rotate > 180) {
      throw new Error('OGP config: rotate must be a finite number in [-180, 180]');
    }
    rotate = raw.rotate;
  }
  let skewX: number | undefined;
  if (raw.skewX != null) {
    if (typeof raw.skewX !== 'number' || !Number.isFinite(raw.skewX) || raw.skewX < -45 || raw.skewX > 45) {
      throw new Error('OGP config: skewX must be a finite number in [-45, 45]');
    }
    skewX = raw.skewX;
  }
  let skewY: number | undefined;
  if (raw.skewY != null) {
    if (typeof raw.skewY !== 'number' || !Number.isFinite(raw.skewY) || raw.skewY < -45 || raw.skewY > 45) {
      throw new Error('OGP config: skewY must be a finite number in [-45, 45]');
    }
    skewY = raw.skewY;
  }

  return {
    version: 1 as const,
    slug: raw.slug,
    type: raw.type,
    colorScheme: raw.colorScheme,
    zoom: raw.zoom,
    translateX: raw.translateX,
    translateY: raw.translateY,
    useTranslate: raw.useTranslate,
    ...(rotate !== undefined ? { rotate } : {}),
    ...(skewX !== undefined ? { skewX } : {}),
    ...(skewY !== undefined ? { skewY } : {}),
    params: raw.params,
    hsl: { h: raw.hsl.h, s: raw.hsl.s, l: raw.hsl.l },
    ...(contrastBrightness ? { contrastBrightness } : {}),
    crop: { x: raw.crop.x, y: raw.crop.y, width: raw.crop.width, height: raw.crop.height },
  };
}
