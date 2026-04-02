import {
  hashString,
  createRandom,
  COLOR_SCHEMES,
  colorSchemesByKey,
  normalizeSchemeKey,
  applyHslAdjust,
  OGP_WIDTH,
  OGP_HEIGHT,
} from '@takazudo/pattern-gen-core';
import type {
  HslAdjust,
  ColorScheme,
  OgpConfig,
  ComposerConfig,
  PatternOptions,
  GenerateOptions,
} from '@takazudo/pattern-gen-core';
import { patternsByName, framesByName } from '@takazudo/pattern-gen-generators';
import { ensureGoogleFont } from './google-fonts-loader.js';

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
      Math.ceil(OGP_WIDTH / config.crop.width),
      Math.ceil(OGP_HEIGHT / config.crop.height),
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
  let patternCanvas: ReturnType<typeof createCanvas>;

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
  const cropW = Math.min(Math.round(config.crop.width * renderSize), renderSize - cropX);
  const cropH = Math.min(Math.round(config.crop.height * renderSize), renderSize - cropY);

  const ogpCanvas = createCanvas(OGP_WIDTH, OGP_HEIGHT);
  const ogpCtx = ogpCanvas.getContext('2d');
  ogpCtx.drawImage(patternCanvas, cropX, cropY, cropW, cropH, 0, 0, OGP_WIDTH, OGP_HEIGHT);

  return {
    buffer: ogpCanvas.toBuffer('image/png'),
    patternName: pattern.name,
    colorSchemeName: scheme.name,
    width: OGP_WIDTH,
    height: OGP_HEIGHT,
  };
}

/**
 * Render an image from a ComposerConfig (background pattern + layers).
 */
export async function renderComposerFromConfig(
  config: ComposerConfig,
): Promise<RenderResult> {
  const { createCanvas, loadImage } = await import('canvas');

  // 1. Render pattern background using existing function
  const bgResult = await renderOgpFromConfig(config.background);
  const bgImage = await loadImage(bgResult.buffer);

  // 2. Create final 1200x630 canvas
  const canvas = createCanvas(OGP_WIDTH, OGP_HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bgImage, 0, 0);

  // 3. Composite each layer
  for (const layer of config.layers) {
    ctx.save();
    ctx.globalAlpha = layer.opacity;

    if (layer.type === 'image') {
      try {
        const img = await loadImage(layer.src);
        const t = layer.transform;
        ctx.drawImage(img, t.x, t.y, t.width, t.height);
      } catch (err) {
        console.error(`Warning: failed to load image layer "${layer.name}":`, (err as Error).message);
      }
    }

    if (layer.type === 'text') {
      // Load font
      const weightStr = layer.fontWeight === 'bold' ? '700' : '400';
      try {
        await ensureGoogleFont(layer.fontFamily, weightStr, layer.fontStyle);
      } catch {
        // Fall back to sans-serif if font can't be loaded
      }

      const t = layer.transform;
      const fontStyle = layer.fontStyle === 'italic' ? 'italic ' : '';
      const fontWeight = layer.fontWeight === 'bold' ? 'bold ' : '';
      ctx.font = `${fontStyle}${fontWeight}${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = layer.textAlign;
      ctx.textBaseline = 'top';

      // Shadow
      if (layer.shadow.enabled) {
        ctx.shadowOffsetX = layer.shadow.offsetX;
        ctx.shadowOffsetY = layer.shadow.offsetY;
        ctx.shadowBlur = layer.shadow.blur;
        ctx.shadowColor = layer.shadow.color;
      }

      // Multiline text rendering
      const lines = layer.content.split('\n');
      const lineHeightPx = layer.fontSize * layer.lineHeight;
      const totalTextHeight = (lines.length - 1) * lineHeightPx + layer.fontSize;

      let textX = t.x;
      if (layer.textAlign === 'center') textX = t.x + t.width / 2;
      else if (layer.textAlign === 'right') textX = t.x + t.width;

      let baseY = t.y;
      if (layer.textVAlign === 'middle') {
        baseY = t.y + (t.height - totalTextHeight) / 2;
      } else if (layer.textVAlign === 'bottom') {
        baseY = t.y + t.height - totalTextHeight;
      }

      for (let i = 0; i < lines.length; i++) {
        const lineY = baseY + i * lineHeightPx;

        if (layer.stroke.enabled) {
          // Save/restore to isolate stroke from shadow state
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = layer.stroke.color;
          ctx.lineWidth = layer.stroke.width;
          ctx.lineJoin = 'round';

          if (layer.letterSpacing !== 0) {
            drawTextWithLetterSpacing(
              ctx,
              lines[i],
              textX,
              lineY,
              layer.letterSpacing,
              'stroke',
            );
          } else {
            ctx.strokeText(lines[i], textX, lineY);
          }
          ctx.restore();
        }

        if (layer.letterSpacing !== 0) {
          drawTextWithLetterSpacing(
            ctx,
            lines[i],
            textX,
            lineY,
            layer.letterSpacing,
            'fill',
          );
        } else {
          ctx.fillText(lines[i], textX, lineY);
        }
      }
    }

    ctx.restore();
  }

  // 4. Render frame on top of everything (mirrors browser drawFrame logic)
  if (config.frame) {
    const frameGen = framesByName.get(config.frame.type);
    if (frameGen) {
      const frameSeed = hashString(config.frame.type);
      const frameRand = createRandom(frameSeed);
      ctx.save();
      frameGen.render(
        ctx as unknown as CanvasRenderingContext2D,
        { width: OGP_WIDTH, height: OGP_HEIGHT, rand: frameRand },
        config.frame.params,
      );
      ctx.restore();
    }
  }

  return {
    buffer: canvas.toBuffer('image/png'),
    patternName: config.background.type,
    colorSchemeName: bgResult.colorSchemeName,
    width: OGP_WIDTH,
    height: OGP_HEIGHT,
  };
}

function drawTextWithLetterSpacing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  text: string,
  x: number,
  y: number,
  spacing: number,
  mode: 'fill' | 'stroke',
): void {
  const savedAlign = ctx.textAlign;
  ctx.textAlign = 'left';

  // Compute total width to adjust for original alignment
  let totalWidth = 0;
  for (const char of text) {
    totalWidth += ctx.measureText(char).width + spacing;
  }
  if (text.length > 0) totalWidth -= spacing; // No spacing after last character

  let currentX = x;
  if (savedAlign === 'center') currentX = x - totalWidth / 2;
  else if (savedAlign === 'right') currentX = x - totalWidth;

  for (const char of text) {
    if (mode === 'fill') ctx.fillText(char, currentX, y);
    else ctx.strokeText(char, currentX, y);
    currentX += ctx.measureText(char).width + spacing;
  }
  ctx.textAlign = savedAlign;
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
