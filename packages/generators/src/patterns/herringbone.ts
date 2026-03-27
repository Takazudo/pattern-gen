import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { darken, lighten } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'gridDivisions', label: 'Grid Divisions', min: 5, max: 20, step: 1, defaultValue: 10 },
  { type: 'slider', key: 'gapFactor', label: 'Gap Factor', min: 0, max: 0.2, step: 0.01, defaultValue: 0.08 },
  { type: 'slider', key: 'colorVariation', label: 'Color Variation', min: 0, max: 0.3, step: 0.01, defaultValue: 0.15 },
];

/**
 * Herringbone pattern — Rectangular bricks arranged in V-shaped zigzag.
 * Classic parquet flooring pattern with alternating horizontal and vertical bricks.
 */
export const herringbone: PatternGenerator = {
  name: 'herringbone',
  displayName: 'Herringbone',
  description: 'V-shaped zigzag brick arrangement — classic parquet flooring',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Brick dimensions
    const gridDivisions = getParam(options, paramDefs, 'gridDivisions');
    const baseBrickW = Math.max(width, height) / gridDivisions;
    const brickW = baseBrickW / zoom;
    const brickH = brickW / 3;

    // Pre-generate per-brick color assignments for determinism
    const unitW = brickW + brickH;
    const unitH = brickH * 2;
    const estCols = Math.ceil(width / unitW) + 6;
    const estRows = Math.ceil(height / unitH) + 6;
    const colorVariationAmount = getParam(options, paramDefs, 'colorVariation');
    const numColorVariations = estCols * estRows * 4 + 64;
    const colorVariations: string[] = [];
    for (let i = 0; i < numColorVariations; i++) {
      const baseColor = fgColors[Math.floor(rand() * fgColors.length)];
      const variation = rand() * colorVariationAmount;
      colorVariations.push(
        rand() < 0.5 ? darken(baseColor, 1 - variation) : lighten(baseColor, variation),
      );
    }

    // Gap between bricks
    const gapFactor = getParam(options, paramDefs, 'gapFactor');
    const gap = brickH * gapFactor;

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
