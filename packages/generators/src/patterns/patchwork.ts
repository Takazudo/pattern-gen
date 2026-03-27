import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { darken, lighten } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'gridDivisions', label: 'Grid Divisions', min: 3, max: 15, step: 1, defaultValue: 6 },
  { type: 'slider', key: 'borderWidth', label: 'Border Width', min: 0.5, max: 3, step: 0.1, defaultValue: 1.5 },
  { type: 'slider', key: 'colorVariation', label: 'Color Variation', min: 0, max: 0.3, step: 0.01, defaultValue: 0.1 },
];

/**
 * Patchwork quilt pattern — Canvas divided into a grid of square blocks,
 * each filled with a random quilt sub-pattern: log cabin, nine-patch,
 * pinwheel, or half-square triangle.
 */
export const patchwork: PatternGenerator = {
  name: 'patchwork',
  displayName: 'Patchwork',
  description: 'Quilt blocks with log cabin, nine-patch, pinwheel, and triangle patterns',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Block size
    const gridDivisions = getParam(options, paramDefs, 'gridDivisions');
    const baseBlockSize = Math.max(width, height) / gridDivisions;
    const blockSize = baseBlockSize / zoom;

    const cols = Math.ceil(width / blockSize) + 1;
    const rows = Math.ceil(height / blockSize) + 1;

    // Quilt sub-pattern functions
    const patterns = [drawLogCabin, drawNinePatch, drawPinwheel, drawHalfSquareTriangle];

    const colorVariation = getParam(options, paramDefs, 'colorVariation');
    const borderWidth = getParam(options, paramDefs, 'borderWidth');

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * blockSize;
        const y = row * blockSize;

        // Pick random pattern and colors for this block
        const patternIdx = Math.floor(rand() * patterns.length);
        const color1 = fgColors[Math.floor(rand() * fgColors.length)];
        const color2 = fgColors[Math.floor(rand() * fgColors.length)];
        const color3 = fgColors[Math.floor(rand() * fgColors.length)];

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, blockSize, blockSize);
        ctx.clip();

        patterns[patternIdx](ctx, x, y, blockSize, [bg, color1, color2, color3], rand, colorVariation);

        ctx.restore();

        // Block border (quilt stitching)
        ctx.strokeStyle = darken(bg, 0.8);
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(x, y, blockSize, blockSize);
      }
    }
  },
};

/** Log cabin: concentric strips spiraling from center */
function drawLogCabin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colors: string[],
  rand: () => number,
  colorVariation: number,
): void {
  const strips = 5;
  const stripW = size / (strips * 2);

  // Center square
  const cx = x + size / 2 - stripW / 2;
  const cy = y + size / 2 - stripW / 2;
  ctx.fillStyle = colors[1];
  ctx.fillRect(cx, cy, stripW, stripW);

  for (let i = 1; i <= strips; i++) {
    const isLight = i % 2 === 0;
    const baseColor = isLight ? colors[2] : colors[3];
    const variation = rand() * colorVariation;
    const color = rand() < 0.5 ? darken(baseColor, 1 - variation) : lighten(baseColor, variation);
    ctx.fillStyle = color;

    const offset = i * stripW;

    // Top strip
    ctx.fillRect(
      x + size / 2 - stripW / 2 - offset,
      y + size / 2 - stripW / 2 - offset,
      stripW * (2 * i) + stripW,
      stripW,
    );
    // Right strip
    ctx.fillRect(
      x + size / 2 + stripW / 2 + offset - stripW,
      y + size / 2 - stripW / 2 - offset + stripW,
      stripW,
      stripW * (2 * i - 1),
    );
    // Bottom strip
    ctx.fillRect(
      x + size / 2 - stripW / 2 - offset,
      y + size / 2 + stripW / 2 + offset - stripW,
      stripW * (2 * i) + stripW,
      stripW,
    );
    // Left strip
    ctx.fillRect(
      x + size / 2 - stripW / 2 - offset,
      y + size / 2 - stripW / 2 - offset + stripW,
      stripW,
      stripW * (2 * i - 1),
    );
  }
}

/** Nine-patch: 3x3 grid of alternating colored squares */
function drawNinePatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colors: string[],
  rand: () => number,
  colorVariation: number,
): void {
  const cellSize = size / 3;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const isAccent = (r + c) % 2 === 0;
      const baseColor = isAccent ? colors[1] : colors[2];
      const variation = rand() * colorVariation;
      const color = rand() < 0.5 ? darken(baseColor, 1 - variation) : lighten(baseColor, variation);

      ctx.fillStyle = color;
      ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize, cellSize);

      // Inner border
      ctx.strokeStyle = darken(color, 0.85);
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + c * cellSize + 1, y + r * cellSize + 1, cellSize - 2, cellSize - 2);
    }
  }
}

/** Pinwheel: four triangles rotating around center */
function drawPinwheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colors: string[],
  rand: () => number,
  colorVariation: number,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const half = size / 2;

  // Background fill
  ctx.fillStyle = colors[0];
  ctx.fillRect(x, y, size, size);

  const quadColors = [colors[1], colors[2], colors[3], colors[1]];

  // Top-left quadrant: triangle
  for (let q = 0; q < 4; q++) {
    const variation = rand() * colorVariation;
    const color = lighten(quadColors[q], variation);
    ctx.fillStyle = color;
    ctx.beginPath();

    switch (q) {
      case 0: // Top-left
        ctx.moveTo(x, y);
        ctx.lineTo(cx, y);
        ctx.lineTo(cx, cy);
        break;
      case 1: // Top-right
        ctx.moveTo(x + size, y);
        ctx.lineTo(x + size, cy);
        ctx.lineTo(cx, cy);
        break;
      case 2: // Bottom-right
        ctx.moveTo(x + size, y + size);
        ctx.lineTo(cx, y + size);
        ctx.lineTo(cx, cy);
        break;
      case 3: // Bottom-left
        ctx.moveTo(x, y + size);
        ctx.lineTo(x, cy);
        ctx.lineTo(cx, cy);
        break;
    }

    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = darken(color, 0.8);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

/** Half-square triangle: diagonal split with two colors */
function drawHalfSquareTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colors: string[],
  rand: () => number,
  colorVariation: number,
): void {
  const half = size / 2;

  // 2x2 grid of half-square triangles
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const bx = x + c * half;
      const by = y + r * half;

      const c1 = colors[1 + ((r + c) % 3)];
      const c2 = colors[1 + ((r + c + 1) % 3)];

      const v1 = rand() * colorVariation;
      const v2 = rand() * colorVariation;
      const color1 = lighten(c1, v1);
      const color2 = darken(c2, 1 - v2);

      const flipDiag = (r + c) % 2 === 0;

      // First triangle
      ctx.fillStyle = color1;
      ctx.beginPath();
      if (flipDiag) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + half, by);
        ctx.lineTo(bx, by + half);
      } else {
        ctx.moveTo(bx + half, by);
        ctx.lineTo(bx + half, by + half);
        ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();

      // Second triangle
      ctx.fillStyle = color2;
      ctx.beginPath();
      if (flipDiag) {
        ctx.moveTo(bx + half, by);
        ctx.lineTo(bx + half, by + half);
        ctx.lineTo(bx, by + half);
      } else {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + half);
        ctx.lineTo(bx + half, by + half);
      }
      ctx.closePath();
      ctx.fill();

      // Diagonal line
      ctx.strokeStyle = darken(colors[0], 0.85);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      if (flipDiag) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + half, by + half);
      } else {
        ctx.moveTo(bx + half, by);
        ctx.lineTo(bx, by + half);
      }
      ctx.stroke();
    }
  }
}
