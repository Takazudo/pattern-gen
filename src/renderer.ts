import { hashString } from './core/hash.js';
import { createRandom } from './core/seeded-random.js';
import { COLOR_SCHEMES, colorSchemesByKey, normalizeSchemeKey } from './core/color-schemes.js';
import { applyHslAdjust } from './core/hsl-adjust.js';
import type { HslAdjust } from './core/hsl-adjust.js';
import { patternsByName } from './patterns/index.js';
import type { ColorScheme } from './core/color-schemes.js';
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
    translateX,
    translateY,
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
    translateX,
    translateY,
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
