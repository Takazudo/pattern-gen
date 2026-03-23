import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { darken, lighten } from '../core/color-utils.js';

/**
 * Isometric cube grid — Each cube shows 3 faces (top, left, right) with
 * different brightness of the same color. Creates an Escher-like 3D
 * impossible geometry illusion.
 */
export const isometric: PatternGenerator = {
  name: 'isometric',
  displayName: 'Isometric',
  description: 'Isometric cube grid with 3D impossible geometry illusion',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Cube dimensions
    const baseCubeSize = Math.max(width, height) / 14;
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
        rowColors.push(fgColors[Math.floor(rand() * fgColors.length)]);
      }
      cubeColors.push(rowColors);
    }

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

        drawIsoCube(ctx, cx, cy, cubeSize, baseColor);
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
): void {
  const h = size;
  const w = size * Math.sqrt(3) / 2;

  // Top face (lightest)
  const topColor = lighten(color, 0.3);
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
  const rightColor = darken(color, 0.65);
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
