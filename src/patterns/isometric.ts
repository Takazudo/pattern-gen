import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { darken, lighten } from '../core/color-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'gridDivisions', label: 'Grid Divisions', min: 6, max: 30, step: 1, defaultValue: 14 },
  { type: 'slider', key: 'topBrightness', label: 'Top Brightness', min: 0, max: 0.5, step: 0.05, defaultValue: 0.3 },
  { type: 'slider', key: 'rightDarkness', label: 'Right Darkness', min: 0.2, max: 0.9, step: 0.05, defaultValue: 0.65 },
];

/**
 * Isometric cube grid — Each cube shows 3 faces (top, left, right) with
 * different brightness of the same color. Creates an Escher-like 3D
 * impossible geometry illusion.
 */
export const isometric: PatternGenerator = {
  name: 'isometric',
  displayName: 'Isometric',
  description: 'Isometric cube grid with 3D impossible geometry illusion',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    // Seed-based randomization for visual diversity
    options = randomizeDefaults(options, paramDefs, options.rand, [
      'gridDivisions', 'topBrightness', 'rightDarkness',
    ]);

    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Seed-based palette offset for color clustering (offset within fg colors only)
    const colorOffset = Math.floor(rand() * fgColors.length);
    // Rotate fg colors by seed-based offset
    const rotatedFg = [...fgColors.slice(colorOffset % fgColors.length), ...fgColors.slice(0, colorOffset % fgColors.length)];

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Cube dimensions
    const gridDivisions = getParam(options, paramDefs, 'gridDivisions');
    const baseCubeSize = Math.max(width, height) / gridDivisions;
    const cubeSize = baseCubeSize / zoom;

    // Isometric grid spacing
    const dx = cubeSize * Math.sqrt(3);
    const dy = cubeSize * 1.5;

    const cols = Math.ceil(width / dx) + 4;
    const rows = Math.ceil(height / dy) + 4;

    // Pre-assign colors to positions
    const cubeColors: string[][] = [];
    for (let row = 0; row < rows + 4; row++) {
      const rowColors: string[] = [];
      for (let col = 0; col < cols + 4; col++) {
        rowColors.push(rotatedFg[Math.floor(rand() * rotatedFg.length)]);
      }
      cubeColors.push(rowColors);
    }

    const topBrightness = getParam(options, paramDefs, 'topBrightness');
    const rightDarkness = getParam(options, paramDefs, 'rightDarkness');

    // Draw cubes back to front (top to bottom)
    for (let row = -2; row < rows; row++) {
      for (let col = -2; col < cols; col++) {
        const isEvenRow = (row & 1) === 0;
        const cx = col * dx + (isEvenRow ? 0 : dx / 2);
        const cy = row * dy;

        // Skip offscreen cubes
        if (cx < -cubeSize * 2 || cx > width + cubeSize * 2 ||
            cy < -cubeSize * 2 || cy > height + cubeSize * 2) continue;

        const baseColor = cubeColors[(row + 2) % cubeColors.length][(col + 2) % cubeColors[0].length];

        drawIsoCube(ctx, cx, cy, cubeSize, baseColor, topBrightness, rightDarkness);
      }
    }
  },
};

function drawIsoCube(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  topBrightness: number,
  rightDarkness: number,
): void {
  const h = size;
  const w = size * Math.sqrt(3) / 2;

  // Top face (lightest)
  const topColor = lighten(color, topBrightness);
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx - w, cy - h / 2);
  ctx.closePath();
  ctx.fill();

  // Left face (medium)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - w, cy + h / 2);
  ctx.closePath();
  ctx.fill();

  // Right face (darkest)
  const rightColor = darken(color, rightDarkness);
  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(cx + w, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx + w, cy + h / 2);
  ctx.closePath();
  ctx.fill();

  // Edge lines for definition
  ctx.strokeStyle = darken(color, 0.4);
  ctx.lineWidth = 0.5;

  // Top face outline
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx - w, cy - h / 2);
  ctx.closePath();
  ctx.stroke();

  // Left face outline
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - w, cy + h / 2);
  ctx.closePath();
  ctx.stroke();

  // Right face outline
  ctx.beginPath();
  ctx.moveTo(cx + w, cy - h / 2);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx + w, cy + h / 2);
  ctx.closePath();
  ctx.stroke();
}
