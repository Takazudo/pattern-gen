import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { withAlpha } from '../core/color-utils.js';
import { getParam } from '../core/param-utils.js';
import { shuffleArray } from '../core/array-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

const paramDefs: ParamDef[] = [
  {
    key: 'cellSize',
    label: 'Cell Size',
    type: 'slider',
    min: 10,
    max: 80,
    step: 1,
    defaultValue: 40,
  },
  {
    key: 'contrast',
    label: 'Contrast',
    type: 'slider',
    min: 0.3,
    max: 1.0,
    step: 0.05,
    defaultValue: 0.8,
  },
  {
    key: 'toothDepth',
    label: 'Tooth Depth',
    type: 'slider',
    min: 0.3,
    max: 1.0,
    step: 0.05,
    defaultValue: 0.7,
  },
  {
    key: 'variant',
    label: 'Variant',
    type: 'select',
    options: [
      { value: 0, label: 'Classic' },
      { value: 1, label: 'Broken' },
      { value: 2, label: 'Stepped' },
      { value: 3, label: 'Diagonal' },
    ],
    defaultValue: 0,
  },
  {
    key: 'rotation',
    label: 'Rotation',
    type: 'select',
    options: [
      { value: 0, label: '0°' },
      { value: 1, label: '90°' },
      { value: 2, label: '180°' },
      { value: 3, label: '270°' },
    ],
    defaultValue: 0,
  },
  {
    key: 'colorCount',
    label: 'Color Count',
    type: 'select',
    options: [
      { value: 1, label: '1 color' },
      { value: 2, label: '2 colors' },
      { value: 3, label: '3 colors' },
    ],
    defaultValue: 1,
  },
];

/** The classic 4x4 houndstooth pattern matrix: 1 = fill, 2 = upper-left triangle, 3 = lower-right triangle */
const PATTERN_MATRIX: number[][] = [
  [1, 1, 2, 0],
  [1, 1, 1, 2],
  [3, 0, 1, 1],
  [3, 1, 1, 1],
];

/** Draw upper-left or lower-right triangle with tooth depth. cellType must be 2 or 3. */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  cellType: number,
  depth: number,
): void {
  const d = size * depth;
  ctx.beginPath();
  if (cellType === 2) {
    // Upper-left triangle
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d);
  } else {
    // Lower-right triangle
    ctx.moveTo(x + size, y + size - d);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size - d, y + size);
  }
  ctx.closePath();
  ctx.fill();
}

function drawClassicCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  patRow: number,
  patCol: number,
  depth: number,
): void {
  const cellType = PATTERN_MATRIX[patRow][patCol];
  if (cellType === 0) return;

  if (cellType === 1) {
    ctx.fillRect(x, y, size, size);
  } else {
    drawTriangle(ctx, x, y, size, cellType, depth);
  }
}

function drawBrokenCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  patRow: number,
  patCol: number,
  depth: number,
  rand: () => number,
): void {
  const cellType = PATTERN_MATRIX[patRow][patCol];
  if (cellType === 0) return;

  // Random chance to skip a cell (creating breaks)
  if (rand() < 0.15) return;

  // Slight size variation for broken look
  const shrink = rand() * 0.1 * size;
  const bx = x + shrink / 2;
  const by = y + shrink / 2;
  const bs = size - shrink;

  if (cellType === 1) {
    ctx.fillRect(bx, by, bs, bs);
  } else {
    drawTriangle(ctx, bx, by, bs, cellType, depth);
  }
}

function drawSteppedCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  patRow: number,
  patCol: number,
  depth: number,
): void {
  const cellType = PATTERN_MATRIX[patRow][patCol];
  if (cellType === 0) return;

  if (cellType === 1) {
    ctx.fillRect(x, y, size, size);
    return;
  }

  // Render triangles as stair-step rectangles
  const steps = Math.max(2, Math.round(size / 4));
  const stepSize = size / steps;

  for (let s = 0; s < steps; s++) {
    if (cellType === 2) {
      // Upper-left: fill width decreases going down (wide at top, narrow at bottom)
      const fillWidth = (1 - s / steps) * depth * size;
      ctx.fillRect(x, y + s * stepSize, fillWidth, stepSize);
    } else {
      // Lower-right: fill width increases going down (narrow at top, wide at bottom)
      const fillWidth = ((s + 1) / steps) * depth * size;
      ctx.fillRect(x + size - fillWidth, y + s * stepSize, fillWidth, stepSize);
    }
  }
}

/**
 * Determine which color group a cell belongs to for multi-color assignment.
 * Group 0: top block (rows 0-1 full squares), Group 1: bottom block (rows 2-3 full squares),
 * Group 2: triangle cells (tooth tips).
 */
function getCellColorGroup(patRow: number, patCol: number): number {
  const cellType = PATTERN_MATRIX[patRow][patCol];
  if (cellType !== 1) return 2; // triangles = group 2
  return patRow < 2 ? 0 : 1;
}

/**
 * Classic houndstooth check pattern with multiple variants.
 * Supports classic, broken, stepped, and diagonal interpretations,
 * adjustable tooth depth, rotation, and multi-color modes.
 */
export const houndstooth: PatternGenerator = {
  name: 'houndstooth',
  displayName: 'Houndstooth',
  description: 'Classic jagged check pattern used in woven textiles',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    const contrast = getParam(options, paramDefs, 'contrast');
    const toothDepth = getParam(options, paramDefs, 'toothDepth');
    const variant = getParam(options, paramDefs, 'variant');
    const rotation = getParam(options, paramDefs, 'rotation');
    const colorCount = getParam(options, paramDefs, 'colorCount');

    // Pick foreground colors
    const shuffled = shuffleArray(fgColors, rand);
    const pickedColors: string[] = [];
    for (let i = 0; i < colorCount; i++) {
      pickedColors.push(shuffled[i % shuffled.length]);
    }

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Cell size
    const baseCellSize = Math.max(width, height) / getParam(options, paramDefs, 'cellSize');
    const cellSize = baseCellSize / zoom;

    // Apply rotation via canvas transform
    ctx.save();

    if (variant === 3) {
      // Diagonal variant: rotate 45 degrees around center
      const cx = width / 2;
      const cy = height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      // Scale up to fill corners after 45-degree rotation
      ctx.scale(1.42, 1.42);
      ctx.translate(-cx, -cy);
    }

    if (rotation > 0) {
      const cx = width / 2;
      const cy = height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-cx, -cy);
    }

    // Expand grid to cover rotated area
    const margin = variant === 3 ? 8 : 4;
    const cols = Math.ceil(width / cellSize) + margin * 2;
    const rows = Math.ceil(height / cellSize) + margin * 2;
    const offsetX = -margin * cellSize;
    const offsetY = -margin * cellSize;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * cellSize;
        const y = offsetY + row * cellSize;
        const patRow = ((row % 4) + 4) % 4;
        const patCol = ((col % 4) + 4) % 4;

        // Pick color based on colorCount and cell group
        const group = getCellColorGroup(patRow, patCol);
        const colorIdx = group % colorCount;
        ctx.fillStyle = withAlpha(pickedColors[colorIdx], contrast);

        if (variant === 0 || variant === 3) {
          // Classic or diagonal (diagonal just rotates the classic grid)
          drawClassicCell(ctx, x, y, cellSize, patRow, patCol, toothDepth);
        } else if (variant === 1) {
          drawBrokenCell(ctx, x, y, cellSize, patRow, patCol, toothDepth, rand);
        } else if (variant === 2) {
          drawSteppedCell(ctx, x, y, cellSize, patRow, patCol, toothDepth);
        }
      }
    }

    ctx.restore();
  },
};
