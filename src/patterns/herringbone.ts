import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { darken, lighten } from '../core/color-utils.js';

/**
 * Herringbone pattern — Rectangular bricks arranged in V-shaped zigzag.
 * Classic parquet flooring pattern with alternating horizontal and vertical bricks.
 */
export const herringbone: PatternGenerator = {
  name: 'herringbone',
  displayName: 'Herringbone',
  description: 'V-shaped zigzag brick arrangement — classic parquet flooring',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Brick dimensions
    const baseBrickW = Math.max(width, height) / 10;
    const brickW = baseBrickW / zoom;
    const brickH = brickW / 3;

    // Pre-generate per-brick color assignments for determinism
    const unitW = brickW + brickH;
    const unitH = brickH * 2;
    const estCols = Math.ceil(width / unitW) + 6;
    const estRows = Math.ceil(height / unitH) + 6;
    const numColorVariations = estCols * estRows * 4 + 64;
    const colorVariations: string[] = [];
    for (let i = 0; i < numColorVariations; i++) {
      const baseColor = fgColors[Math.floor(rand() * fgColors.length)];
      const variation = rand() * 0.15;
      colorVariations.push(
        rand() < 0.5 ? darken(baseColor, 1 - variation) : lighten(baseColor, variation),
      );
    }

    // Gap between bricks
    const gap = brickH * 0.08;

    const cols = Math.ceil(width / unitW) + 3;
    const rows = Math.ceil(height / unitH) + 3;

    ctx.lineWidth = 0.5;

    let colorIdx = 0;

    for (let row = -2; row < rows; row++) {
      for (let col = -2; col < cols; col++) {
        const baseX = col * unitW;
        const baseY = row * unitH;

        // Horizontal brick (top of V)
        {
          const bx = baseX;
          const by = baseY;
          const color = colorVariations[colorIdx % colorVariations.length];
          colorIdx++;

          ctx.fillStyle = color;
          ctx.fillRect(bx + gap, by + gap, brickW - gap * 2, brickH - gap * 2);

          // Top edge highlight
          ctx.strokeStyle = lighten(color, 0.15);
          ctx.beginPath();
          ctx.moveTo(bx + gap, by + gap);
          ctx.lineTo(bx + brickW - gap, by + gap);
          ctx.stroke();

          // Bottom edge shadow
          ctx.strokeStyle = darken(color, 0.8);
          ctx.beginPath();
          ctx.moveTo(bx + gap, by + brickH - gap);
          ctx.lineTo(bx + brickW - gap, by + brickH - gap);
          ctx.stroke();
        }

        // Vertical brick (bottom of V, offset)
        {
          const vx = baseX + brickW;
          const vy = baseY;
          const color = colorVariations[colorIdx % colorVariations.length];
          colorIdx++;

          ctx.fillStyle = color;
          ctx.fillRect(vx + gap, vy + gap, brickH - gap * 2, brickW - gap * 2);

          // Left edge highlight
          ctx.strokeStyle = lighten(color, 0.15);
          ctx.beginPath();
          ctx.moveTo(vx + gap, vy + gap);
          ctx.lineTo(vx + gap, vy + brickW - gap);
          ctx.stroke();

          // Right edge shadow
          ctx.strokeStyle = darken(color, 0.8);
          ctx.beginPath();
          ctx.moveTo(vx + brickH - gap, vy + gap);
          ctx.lineTo(vx + brickH - gap, vy + brickW - gap);
          ctx.stroke();
        }

        // Second row: shifted V
        {
          const bx2 = baseX + brickH;
          const by2 = baseY + brickH;
          const color = colorVariations[colorIdx % colorVariations.length];
          colorIdx++;

          ctx.fillStyle = color;
          ctx.fillRect(bx2 + gap, by2 + gap, brickW - gap * 2, brickH - gap * 2);

          ctx.strokeStyle = lighten(color, 0.15);
          ctx.beginPath();
          ctx.moveTo(bx2 + gap, by2 + gap);
          ctx.lineTo(bx2 + brickW - gap, by2 + gap);
          ctx.stroke();

          ctx.strokeStyle = darken(color, 0.8);
          ctx.beginPath();
          ctx.moveTo(bx2 + gap, by2 + brickH - gap);
          ctx.lineTo(bx2 + brickW - gap, by2 + brickH - gap);
          ctx.stroke();
        }

        {
          const vx2 = baseX + brickH + brickW;
          const vy2 = baseY + brickH;
          const color = colorVariations[colorIdx % colorVariations.length];
          colorIdx++;

          ctx.fillStyle = color;
          ctx.fillRect(vx2 + gap, vy2 + gap, brickH - gap * 2, brickW - gap * 2);

          ctx.strokeStyle = lighten(color, 0.15);
          ctx.beginPath();
          ctx.moveTo(vx2 + gap, vy2 + gap);
          ctx.lineTo(vx2 + gap, vy2 + brickW - gap);
          ctx.stroke();

          ctx.strokeStyle = darken(color, 0.8);
          ctx.beginPath();
          ctx.moveTo(vx2 + brickH - gap, vy2 + gap);
          ctx.lineTo(vx2 + brickH - gap, vy2 + brickW - gap);
          ctx.stroke();
        }
      }
    }
  },
};
