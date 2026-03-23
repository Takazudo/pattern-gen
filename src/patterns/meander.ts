import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { withAlpha, darken, lighten } from '../core/color-utils.js';

const paramDefs: ParamDef[] = [
  {
    key: 'unitSize',
    label: 'Unit Size',
    type: 'slider',
    min: 10,
    max: 80,
    step: 1,
    defaultValue: 40,
  },
  {
    key: 'lineWidth',
    label: 'Line Width',
    type: 'slider',
    min: 1,
    max: 10,
    step: 0.5,
    defaultValue: 4,
  },
  {
    key: 'frameCount',
    label: 'Frame Count',
    type: 'slider',
    min: 1,
    max: 5,
    step: 1,
    defaultValue: 2,
  },
];

/**
 * Meander pattern — Greek key / meander with nested rectangular spirals.
 * Arranged as repeating tiles that connect seamlessly. Supports nested
 * concentric frames.
 */
export const meander: PatternGenerator = {
  name: 'meander',
  displayName: 'Meander',
  description: 'Greek key meander with nested rectangular spirals in concentric frames',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Pick main key color and accent
    const keyColor = fgColors[Math.floor(rand() * fgColors.length)];
    const accentColor = fgColors[Math.floor(rand() * fgColors.length)];

    // Tile sizing
    const unitSizeDivisor = getParam(options, paramDefs, 'unitSize');
    const baseUnit = Math.max(width, height) / unitSizeDivisor;
    const unit = baseUnit / zoom;
    const lineWidth = Math.max(2, getParam(options, paramDefs, 'lineWidth'));

    // Number of concentric frames (1-3)
    const numFrames = options.params?.frameCount ?? 1 + Math.floor(rand() * 3);
    const frameSpacing = unit * 5;

    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    for (let frame = 0; frame < numFrames; frame++) {
      const inset = frame * frameSpacing;
      const fx = inset;
      const fy = inset;
      const fw = width - inset * 2;
      const fh = height - inset * 2;

      if (fw <= unit * 6 || fh <= unit * 6) break;

      const currentColor = frame % 2 === 0 ? keyColor : accentColor;
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = lineWidth;

      // Draw frame border
      ctx.strokeRect(fx + lineWidth / 2, fy + lineWidth / 2, fw - lineWidth, fh - lineWidth);

      // Draw meander pattern along each side
      // Top border
      drawMeanderLine(ctx, fx + unit * 3, fy + unit, fw - unit * 6, unit * 3, 'horizontal', currentColor, lineWidth);
      // Bottom border
      drawMeanderLine(ctx, fx + unit * 3, fy + fh - unit * 4, fw - unit * 6, unit * 3, 'horizontal', currentColor, lineWidth);
      // Left border
      drawMeanderLine(ctx, fx + unit, fy + unit * 3, fh - unit * 6, unit * 3, 'vertical', currentColor, lineWidth);
      // Right border
      drawMeanderLine(ctx, fx + fw - unit * 4, fy + unit * 3, fh - unit * 6, unit * 3, 'vertical', currentColor, lineWidth);
    }

    // Fill the interior with a tiled Greek key pattern
    const tileSize = unit * 4;
    const interiorInset = numFrames * frameSpacing + unit;
    const startX = interiorInset;
    const startY = interiorInset;
    const endX = width - interiorInset;
    const endY = height - interiorInset;

    ctx.strokeStyle = withAlpha(keyColor, 0.6);
    ctx.lineWidth = Math.max(1.5, lineWidth * 0.7);

    for (let y = startY; y < endY; y += tileSize) {
      for (let x = startX; x < endX; x += tileSize) {
        drawGreekKeyTile(ctx, x, y, tileSize, unit);
      }
    }

    // Subtle shadow effect on outer frame
    if (numFrames > 0) {
      ctx.strokeStyle = withAlpha(darken(keyColor, 0.4), 0.15);
      ctx.lineWidth = lineWidth + 2;
      ctx.strokeRect(2, 2, width - 4, height - 4);
    }
  },
};

/** Draw a meander (Greek key) pattern along a line */
function drawMeanderLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  bandHeight: number,
  direction: 'horizontal' | 'vertical',
  color: string,
  lineWidth: number,
): void {
  if (length <= 0) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const step = bandHeight;
  const numKeys = Math.floor(length / step);
  if (numKeys <= 0) return;

  for (let i = 0; i < numKeys; i++) {
    const isEven = i % 2 === 0;

    if (direction === 'horizontal') {
      const kx = x + i * step;
      const ky = y;
      drawSingleKey(ctx, kx, ky, step, bandHeight, isEven);
    } else {
      const kx = x;
      const ky = y + i * step;
      drawSingleKeyVertical(ctx, kx, ky, bandHeight, step, isEven);
    }
  }
}

/** Draw a single Greek key motif (horizontal) */
function drawSingleKey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flipped: boolean,
): void {
  const inset = w * 0.25;

  ctx.beginPath();
  if (flipped) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + inset, y + h);
    ctx.lineTo(x + inset, y + inset);
    ctx.lineTo(x + w - inset, y + inset);
    ctx.lineTo(x + w - inset, y + h - inset);
    ctx.lineTo(x, y + h - inset);
  } else {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w - inset, y + h);
    ctx.lineTo(x + w - inset, y + inset);
    ctx.lineTo(x + inset, y + inset);
    ctx.lineTo(x + inset, y + h - inset);
    ctx.lineTo(x + w, y + h - inset);
  }
  ctx.stroke();
}

/** Draw a single Greek key motif (vertical) */
function drawSingleKeyVertical(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flipped: boolean,
): void {
  const inset = h * 0.25;

  ctx.beginPath();
  if (flipped) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + inset);
    ctx.lineTo(x + inset, y + inset);
    ctx.lineTo(x + inset, y + h - inset);
    ctx.lineTo(x + w - inset, y + h - inset);
    ctx.lineTo(x + w - inset, y);
  } else {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - inset);
    ctx.lineTo(x + inset, y + h - inset);
    ctx.lineTo(x + inset, y + inset);
    ctx.lineTo(x + w - inset, y + inset);
    ctx.lineTo(x + w - inset, y + h);
  }
  ctx.stroke();
}

/** Draw a single repeating Greek key tile for the interior fill */
function drawGreekKeyTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  unit: number,
): void {
  const s = size;
  const u = unit * 0.8;

  // Spiral inward
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s, y + s);
  ctx.lineTo(x + u, y + s);
  ctx.lineTo(x + u, y + u);
  ctx.lineTo(x + s - u, y + u);
  ctx.lineTo(x + s - u, y + s - u);
  ctx.lineTo(x + u * 2, y + s - u);
  ctx.stroke();
}
