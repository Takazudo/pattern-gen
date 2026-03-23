import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { createNoise2D } from '../core/noise.js';
import { withAlpha } from '../core/color-utils.js';

/**
 * Flow Field pattern — Perlin/simplex noise-driven flow field.
 * Thousands of small line segments follow noise-derived angles across the canvas,
 * creating wind current or hair strand visuals.
 */
export const flowField: PatternGenerator = {
  name: 'flow-field',
  displayName: 'Flow Field',
  description: 'Noise-driven flow field with streaming particle lines',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const noise = createNoise2D(rand);

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const noiseScale = 0.003 * zoom;
    const lineCount = Math.floor(width * height * 0.004);
    const stepLength = 2;
    const stepsPerLine = 20 + Math.floor(30 / zoom);

    ctx.lineCap = 'round';

    for (let i = 0; i < lineCount; i++) {
      let x = rand() * width;
      let y = rand() * height;

      const colorIndex = Math.floor(rand() * fgColors.length);
      const color = fgColors[colorIndex];
      const alpha = 0.3 + rand() * 0.5;
      const lineWidth = 0.5 + rand() * 1.5;

      ctx.strokeStyle = withAlpha(color, alpha);
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x, y);

      for (let s = 0; s < stepsPerLine; s++) {
        const angle = noise(x * noiseScale, y * noiseScale) * Math.PI * 2;
        x += Math.cos(angle) * stepLength;
        y += Math.sin(angle) * stepLength;

        // Stop if out of bounds
        if (x < 0 || x > width || y < 0 || y > height) break;

        ctx.lineTo(x, y);
      }

      ctx.stroke();
    }
  },
};
