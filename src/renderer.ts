import { hashString } from './core/hash.js';
import { createRandom } from './core/seeded-random.js';
import { COLOR_SCHEMES, colorSchemesByKey, normalizeSchemeKey } from './core/color-schemes.js';
import { applyHslAdjust } from './core/hsl-adjust.js';
import type { HslAdjust } from './core/hsl-adjust.js';
import { patternsByName } from './patterns/index.js';
import type { ColorScheme } from './core/color-schemes.js';
import type { OgpConfig } from './core/ogp-config.js';
import type { PatternOptions, GenerateOptions } from './core/types.js';

/** Resolve a color scheme from name/seed, optionally overriding the background. */
function resolveColorScheme(
  schemeName: string | undefined,
  seed: number,
  bg?: string,
): ColorScheme {
  let scheme: ColorScheme;
  if (schemeName) {
    if (schemeName === 'random') {
      scheme = COLOR_SCHEMES[seed % COLOR_SCHEMES.length];
    } else {
      const found = colorSchemesByKey.get(normalizeSchemeKey(schemeName));
      if (!found) throw new Error(`Unknown color scheme: "${schemeName}"`);
      scheme = found;
    }
  } else {
    scheme = COLOR_SCHEMES[seed % COLOR_SCHEMES.length];
  }
  if (bg) {
    scheme = { ...scheme, palette: [bg, ...scheme.palette.slice(1)] as ColorScheme['palette'] };
  }
  return scheme;
}

export interface RenderResult {
  /** PNG buffer of the rendered pattern */
  buffer: Buffer;
  /** Pattern type used */
  patternName: string;
  /** Color scheme used */
  colorSchemeName: string;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
}

/**
 * Render a pattern to a PNG buffer (Node.js only — requires `canvas` package).
 */
export async function renderPattern(options: GenerateOptions): Promise<RenderResult> {
  // Dynamic import of canvas (optional dependency for Node.js)
  const { createCanvas } = await import('canvas');

  const size = options.size ?? 800;
  const zoom = options.zoom ?? 1;

  const pattern = patternsByName.get(options.type);
  if (!pattern) {
    const available = [...patternsByName.keys()].join(', ');
    throw new Error(`Unknown pattern type: "${options.type}". Available: ${available}`);
  }

  const seed = hashString(options.slug);
  const rand = createRandom(seed);
  const scheme = resolveColorScheme(options.colorScheme, seed, options.bg);

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const translateX = options.translateX ?? 0;
  const translateY = options.translateY ?? 0;

  const patternOptions: PatternOptions = {
    width: size,
    height: size,
    rand,
    colorScheme: scheme,
    zoom,
    params: options.params,
  };

  const tx = translateX * size;
  const ty = translateY * size;
  ctx.save();
  ctx.translate(tx, ty);
  pattern.generate(ctx as unknown as CanvasRenderingContext2D, patternOptions);
  ctx.restore();

  if (options.hsl) {
    applyHslAdjust(ctx as unknown as CanvasRenderingContext2D, size, size, options.hsl);
  }

  const buffer = canvas.toBuffer('image/png');

  return {
    buffer,
    patternName: pattern.name,
    colorSchemeName: scheme.name,
    width: size,
    height: size,
  };
}

const OGP_OUTPUT_WIDTH = 1200;
const OGP_OUTPUT_HEIGHT = 630;

/**
 * Render an OGP image from a serialized OgpConfig.
 * Generates the pattern at a size large enough for the crop region,
 * applies HSL adjustments, crops, and scales to 1200x630.
 */
export async function renderOgpFromConfig(config: OgpConfig): Promise<RenderResult> {
  const { createCanvas } = await import('canvas');

  // Cap at 4000 so the useTranslate 3x branch stays under 12000px
  const renderSize = Math.min(
    4000,
    Math.max(
      800,
      Math.ceil(OGP_OUTPUT_WIDTH / config.crop.width),
      Math.ceil(OGP_OUTPUT_HEIGHT / config.crop.height),
    ),
  );

  const pattern = patternsByName.get(config.type);
  if (!pattern) {
    const available = [...patternsByName.keys()].join(', ');
    throw new Error(`Unknown pattern type: "${config.type}". Available: ${available}`);
  }

  const seed = hashString(config.slug);
  const rand = createRandom(seed);
  const scheme = resolveColorScheme(config.colorScheme, seed);

  // Create the pattern canvas
  let patternCanvas;

  if (config.useTranslate) {
    // Replicate the viewer's 3x offscreen canvas approach
    const scale = 3;
    const bigSize = renderSize * scale;
    const offscreen = createCanvas(bigSize, bigSize);
    const offCtx = offscreen.getContext('2d');

    pattern.generate(offCtx as unknown as CanvasRenderingContext2D, {
      width: bigSize,
      height: bigSize,
      rand,
      colorScheme: scheme,
      zoom: config.zoom,
      params: Object.keys(config.params).length > 0 ? config.params : undefined,
    });

    // Extract the visible portion with translate offset
    patternCanvas = createCanvas(renderSize, renderSize);
    const patCtx = patternCanvas.getContext('2d');
    const baseOffset = -renderSize * (scale - 1) / 2;
    const tx = config.translateX * renderSize;
    const ty = config.translateY * renderSize;
    patCtx.save();
    patCtx.translate(baseOffset + tx, baseOffset + ty);
    patCtx.drawImage(offscreen, 0, 0);
    patCtx.restore();
  } else {
    // Simple render (no translate offscreen)
    patternCanvas = createCanvas(renderSize, renderSize);
    const patCtx = patternCanvas.getContext('2d');

    const patternOptions: PatternOptions = {
      width: renderSize,
      height: renderSize,
      rand,
      colorScheme: scheme,
      zoom: config.zoom,
      params: Object.keys(config.params).length > 0 ? config.params : undefined,
    };

    // When useTranslate is false, the viewer skips translate entirely
    // (translateX/Y are reset to 0), so we render directly without offset.
    pattern.generate(patCtx as unknown as CanvasRenderingContext2D, patternOptions);
  }

  // Apply HSL adjustments
  const patCtx = patternCanvas.getContext('2d');
  if (config.hsl.h !== 0 || config.hsl.s !== 0 || config.hsl.l !== 0) {
    applyHslAdjust(patCtx as unknown as CanvasRenderingContext2D, renderSize, renderSize, config.hsl);
  }

  // Crop to OGP region and scale to 1200x630
  const cropX = Math.round(config.crop.x * renderSize);
  const cropY = Math.round(config.crop.y * renderSize);
  const cropW = Math.round(config.crop.width * renderSize);
  const cropH = Math.round(config.crop.height * renderSize);

  const ogpCanvas = createCanvas(OGP_OUTPUT_WIDTH, OGP_OUTPUT_HEIGHT);
  const ogpCtx = ogpCanvas.getContext('2d');
  ogpCtx.drawImage(patternCanvas, cropX, cropY, cropW, cropH, 0, 0, OGP_OUTPUT_WIDTH, OGP_OUTPUT_HEIGHT);

  return {
    buffer: ogpCanvas.toBuffer('image/png'),
    patternName: pattern.name,
    colorSchemeName: scheme.name,
    width: OGP_OUTPUT_WIDTH,
    height: OGP_OUTPUT_HEIGHT,
  };
}

/**
 * Generate a pattern on a browser CanvasRenderingContext2D.
 * Use this in the viewer app (no Node.js dependencies needed).
 */
export function renderPatternToCanvas(
  ctx: CanvasRenderingContext2D,
  slug: string,
  typeName: string,
  options?: {
    size?: number;
    zoom?: number;
    translateX?: number;
    translateY?: number;
    bg?: string;
    colorScheme?: string;
    params?: Record<string, number>;
    hsl?: HslAdjust;
  },
): { colorSchemeName: string } {
  const zoom = options?.zoom ?? 1;
  const translateX = options?.translateX ?? 0;
  const translateY = options?.translateY ?? 0;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  const pattern = patternsByName.get(typeName);
  if (!pattern) {
    throw new Error(`Unknown pattern type: "${typeName}"`);
  }

  const seed = hashString(slug);
  const rand = createRandom(seed);
  const scheme = resolveColorScheme(options?.colorScheme, seed, options?.bg);

  const patternOptions: PatternOptions = {
    width,
    height,
    rand,
    colorScheme: scheme,
    zoom,
    params: options?.params,
  };

  const tx = translateX * width;
  const ty = translateY * height;
  ctx.save();
  ctx.translate(tx, ty);
  pattern.generate(ctx, patternOptions);
  ctx.restore();

  if (options?.hsl) {
    applyHslAdjust(ctx, width, height, options.hsl);
  }

  return { colorSchemeName: scheme.name };
}
