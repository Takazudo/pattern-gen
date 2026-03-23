import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { darken, lighten } from '../core/color-utils.js';

/**
 * Truchet pattern — Quarter-circle arc tiles in a square grid, randomly oriented per cell.
 * Creates flowing organic curves that connect across tile boundaries.
 * Multi-scale variant adds smaller tiles for extra complexity.
 */
export const truchet: PatternGenerator = {
  name: 'truchet',
  displayName: 'Truchet',
  description: 'Quarter-circle arc tiles creating flowing organic curves',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const baseTileSize = Math.max(width, height) / 12;
    const tileSize = baseTileSize / zoom;

    // Pick 2-3 arc colors from palette
    const numColors = 2 + Math.floor(rand() * 2);
    const arcColors: string[] = [];
    const shuffled = [...fgColors];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i < numColors; i++) {
      arcColors.push(shuffled[i]);
    }

    const cols = Math.ceil(width / tileSize) + 2;
    const rows = Math.ceil(height / tileSize) + 2;

    // Line width proportional to tile size
    const lineWidth = tileSize * 0.15;

    // Draw main grid
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * tileSize;
        const y = row * tileSize;
        const orientation = rand() < 0.5;
        const colorIdx = Math.floor(rand() * arcColors.length);
        const color = arcColors[colorIdx];

        drawTruchetTile(ctx, x, y, tileSize, orientation, color, lineWidth);
      }
    }

    // Multi-scale: overlay smaller tiles at random positions for complexity
    const smallTileSize = tileSize / 2;
    const smallLineWidth = smallTileSize * 0.12;
    const smallCols = Math.ceil(width / smallTileSize) + 2;
    const smallRows = Math.ceil(height / smallTileSize) + 2;

    ctx.globalAlpha = 0.3;
    for (let row = -1; row < smallRows; row++) {
      for (let col = -1; col < smallCols; col++) {
        // Only draw some of the small tiles
        if (rand() < 0.7) continue;
        const x = col * smallTileSize;
        const y = row * smallTileSize;
        const orientation = rand() < 0.5;
        const colorIdx = Math.floor(rand() * arcColors.length);
        const color = lighten(arcColors[colorIdx], 0.2);

        drawTruchetTile(ctx, x, y, smallTileSize, orientation, color, smallLineWidth);
      }
    }
    ctx.globalAlpha = 1;
  },
};

function drawTruchetTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  orientation: boolean,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  const r = size / 2;

  if (orientation) {
    // Arc from top-left corner
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI / 2);
    ctx.stroke();

    // Arc from bottom-right corner
    ctx.beginPath();
    ctx.arc(x + size, y + size, r, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  } else {
    // Arc from top-right corner
    ctx.beginPath();
    ctx.arc(x + size, y, r, Math.PI / 2, Math.PI);
    ctx.stroke();

    // Arc from bottom-left corner
    ctx.beginPath();
    ctx.arc(x, y + size, r, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();
  }

  // Subtle shadow arcs for depth
  ctx.strokeStyle = darken(color, 0.7);
  ctx.lineWidth = lineWidth * 0.3;

  if (orientation) {
    ctx.beginPath();
    ctx.arc(x, y, r + lineWidth * 0.5, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size, y + size, r + lineWidth * 0.5, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x + size, y, r + lineWidth * 0.5, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y + size, r + lineWidth * 0.5, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();
  }
}
