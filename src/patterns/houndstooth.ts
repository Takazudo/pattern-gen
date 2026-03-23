import type { PatternGenerator, PatternOptions } from '../core/types.js';

/**
 * Classic houndstooth check pattern.
 * Each unit cell is a 2x2 grid where each cell is divided diagonally,
 * creating the distinctive jagged tooth-like check pattern.
 */
export const houndstooth: PatternGenerator = {
  name: 'houndstooth',
  displayName: 'Houndstooth',
  description: 'Classic jagged check pattern used in woven textiles',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Pick two colors for the houndstooth
    const colorA = bg;
    const colorB = fgColors[Math.floor(rand() * fgColors.length)];

    // Fill background
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, width, height);

    // Cell size — the houndstooth repeats every 4 cells
    const baseCellSize = Math.max(width, height) / 40;
    const cellSize = baseCellSize / zoom;

    // The classic houndstooth pattern is defined on a 4x4 grid
    // where 1 = colorB and 0 = colorA, with specific diagonal cuts
    // Pattern matrix (each row is one cell height):
    //   Row 0: [B, B, A, A]  with B cells having right-pointing tooth
    //   Row 1: [B, B, B, A]  with tooth extension
    //   Row 2: [A, A, B, B]  with B cells having right-pointing tooth
    //   Row 3: [A, B, B, B]  with tooth extension

    const cols = Math.ceil(width / cellSize) + 4;
    const rows = Math.ceil(height / cellSize) + 4;

    ctx.fillStyle = colorB;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellSize;
        const y = row * cellSize;
        const patRow = ((row % 4) + 4) % 4;
        const patCol = ((col % 4) + 4) % 4;

        // Determine if this cell should be filled and how
        if (patRow === 0) {
          if (patCol === 0 || patCol === 1) {
            // Full square
            ctx.fillRect(x, y, cellSize, cellSize);
          } else if (patCol === 2) {
            // Upper-left triangle (tooth pointing right)
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + cellSize, y);
            ctx.lineTo(x, y + cellSize);
            ctx.closePath();
            ctx.fill();
          }
        } else if (patRow === 1) {
          if (patCol === 0 || patCol === 1) {
            // Full square
            ctx.fillRect(x, y, cellSize, cellSize);
          } else if (patCol === 2) {
            // Full square (tooth extension)
            ctx.fillRect(x, y, cellSize, cellSize);
          } else if (patCol === 3) {
            // Upper-left triangle
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + cellSize, y);
            ctx.lineTo(x, y + cellSize);
            ctx.closePath();
            ctx.fill();
          }
        } else if (patRow === 2) {
          if (patCol === 2 || patCol === 3) {
            // Full square
            ctx.fillRect(x, y, cellSize, cellSize);
          } else if (patCol === 0) {
            // Lower-right triangle (tooth pointing left)
            ctx.beginPath();
            ctx.moveTo(x + cellSize, y);
            ctx.lineTo(x + cellSize, y + cellSize);
            ctx.lineTo(x, y + cellSize);
            ctx.closePath();
            ctx.fill();
          }
        } else if (patRow === 3) {
          if (patCol === 2 || patCol === 3) {
            // Full square
            ctx.fillRect(x, y, cellSize, cellSize);
          } else if (patCol === 1) {
            // Full square (tooth extension)
            ctx.fillRect(x, y, cellSize, cellSize);
          } else if (patCol === 0) {
            // Lower-right triangle
            ctx.beginPath();
            ctx.moveTo(x + cellSize, y);
            ctx.lineTo(x + cellSize, y + cellSize);
            ctx.lineTo(x, y + cellSize);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  },
};
