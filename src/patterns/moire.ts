import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { withAlpha } from '../core/color-utils.js';

/**
 * Moiré interference pattern from overlaid line grids at slight angle offsets.
 * Drawing multiple sets of parallel lines at slightly different angles creates
 * visual interference bands where the lines overlap.
 */
export const moire: PatternGenerator = {
  name: 'moire',
  displayName: 'Moiré',
  description: 'Interference patterns from overlapping line grids at slight angle offsets',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Number of grid layers: 2 or 3
    const numLayers = 2 + Math.floor(rand() * 2);

    // Line spacing and base angle
    const baseSpacing = (6 + rand() * 6) / zoom; // 6-12px base spacing
    const lineWidth = Math.max(0.5, (1 + rand() * 1.5) / zoom);
    const baseAngle = rand() * Math.PI;

    // Diagonal of canvas for calculating line extent
    const diagonal = Math.sqrt(width * width + height * height);
    const cx = width / 2;
    const cy = height / 2;

    ctx.lineWidth = lineWidth;

    for (let layer = 0; layer < numLayers; layer++) {
      // Each layer has a slightly different angle
      const angleDelta = (layer === 0) ? 0 : (0.02 + rand() * 0.06) * (rand() < 0.5 ? 1 : -1);
      const angle = baseAngle + angleDelta * (layer);
      const spacing = baseSpacing * (1 + layer * 0.05 * (rand() < 0.5 ? 1 : -1));

      const color = fgColors[layer % fgColors.length];
      const alpha = 0.3 + rand() * 0.2;
      ctx.strokeStyle = withAlpha(color, alpha);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Number of lines needed to cover canvas
      const numLines = Math.ceil(diagonal / spacing) + 2;

      for (let i = -Math.floor(numLines / 2); i <= Math.floor(numLines / 2); i++) {
        // Offset perpendicular to the angle
        const offsetX = i * spacing * cosA;
        const offsetY = i * spacing * sinA;

        // Line endpoints extending across the full diagonal
        const x1 = cx + offsetX - diagonal * sinA;
        const y1 = cy + offsetY + diagonal * cosA;
        const x2 = cx + offsetX + diagonal * sinA;
        const y2 = cy + offsetY - diagonal * cosA;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  },
};
