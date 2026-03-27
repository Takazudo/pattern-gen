import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { lerpColor } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  {
    key: 'rowHeight',
    label: 'Row Height',
    type: 'slider',
    min: 4,
    max: 30,
    step: 1,
    defaultValue: 16,
  },
  {
    key: 'gradientSteps',
    label: 'Gradient Steps',
    type: 'slider',
    min: 0,
    max: 20,
    step: 1,
    defaultValue: 0,
  },
];

/**
 * Zigzag/chevron stripes with gradient color transitions between rows.
 * Draws V-shaped bands across the canvas, each row using a different
 * palette color with smooth gradients between adjacent rows.
 */
export const chevron: PatternGenerator = {
  name: 'chevron',
  displayName: 'Chevron',
  description: 'Zigzag V-shaped stripes with smooth color gradients between rows',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Chevron parameters
    const baseRowHeight = Math.max(width, height) / getParam(options, paramDefs, 'rowHeight');
    const rowHeight = baseRowHeight / zoom;

    // Seed-based stripe width wobble factor (0.85–1.15x per row)
    const wobbleStrength = 0.05 + rand() * 0.10;

    // Build color sequence by cycling and shuffling palette colors
    const colorSequence: string[] = [];
    const shuffled = shuffleArray(fgColors, rand);
    // Repeat enough to fill the canvas
    const rowCount = Math.ceil(height / rowHeight) + 4;
    // Pre-compute per-row wobble factors
    const rowWobble: number[] = [];
    for (let i = 0; i < rowCount; i++) {
      colorSequence.push(shuffled[i % shuffled.length]);
      rowWobble.push(1 + (rand() * 2 - 1) * wobbleStrength);
    }

    // Number of sub-rows for gradient between each chevron band
    const gradientStepsParam = getParam(options, paramDefs, 'gradientSteps');
    const gradientSteps = gradientStepsParam > 0 ? gradientStepsParam : Math.max(4, Math.ceil(rowHeight / 3));
    const subRowHeight = rowHeight / gradientSteps;

    // Draw chevron rows from top to bottom
    // Track cumulative Y to account for wobbled row heights
    let cumulativeY = -2 * rowHeight;
    for (let row = -2; row < rowCount; row++) {
      const currentColor = colorSequence[((row % colorSequence.length) + colorSequence.length) % colorSequence.length];
      const nextColor = colorSequence[(((row + 1) % colorSequence.length) + colorSequence.length) % colorSequence.length];

      const wobbleIdx = ((row % rowWobble.length) + rowWobble.length) % rowWobble.length;
      const wobbledRowHeight = rowHeight * rowWobble[wobbleIdx];
      const wobbledSubRowHeight = wobbledRowHeight / gradientSteps;

      for (let step = 0; step < gradientSteps; step++) {
        const t = step / gradientSteps;
        const color = lerpColor(currentColor, nextColor, t);

        const baseY = cumulativeY + step * wobbledSubRowHeight;

        // Draw the V-shape (chevron) as a filled polygon
        ctx.fillStyle = color;
        ctx.beginPath();

        // Left arm of V
        const y0 = baseY;
        const y1 = baseY + wobbledSubRowHeight;

        // Top edge of sub-row: V shape
        ctx.moveTo(0, y0 + wobbledRowHeight);
        ctx.lineTo(width / 2, y0);
        ctx.lineTo(width, y0 + wobbledRowHeight);

        // Bottom edge of sub-row: V shape (shifted down)
        ctx.lineTo(width, y1 + wobbledRowHeight);
        ctx.lineTo(width / 2, y1);
        ctx.lineTo(0, y1 + wobbledRowHeight);

        ctx.closePath();
        ctx.fill();
      }
      cumulativeY += wobbledRowHeight;
    }
  },
};
