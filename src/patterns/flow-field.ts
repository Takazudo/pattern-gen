import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { createNoise2D } from '../core/noise.js';
import { withAlpha } from '../core/color-utils.js';

const paramDefs: ParamDef[] = [
  { key: 'noiseScale', label: 'Noise Scale', type: 'slider', min: 0.001, max: 0.01, step: 0.001, defaultValue: 0.003 },
  { key: 'lineCount', label: 'Line Count', type: 'slider', min: 500, max: 5000, step: 100, defaultValue: 2000 },
  { key: 'stepsPerLine', label: 'Steps per Line', type: 'slider', min: 5, max: 80, step: 1, defaultValue: 35 },
  { key: 'lineWidth', label: 'Line Width', type: 'slider', min: 0.3, max: 3, step: 0.1, defaultValue: 1 },
];

/**
 * Flow Field pattern — Perlin/simplex noise-driven flow field.
 * Thousands of small line segments follow noise-derived angles across the canvas,
 * creating wind current or hair strand visuals.
 */
export const flowField: PatternGenerator = {
  name: 'flow-field',
  displayName: 'Flow Field',
  description: 'Noise-driven flow field with streaming particle lines',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const noise = createNoise2D(rand);

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const noiseScale = getParam(options, paramDefs, 'noiseScale') * zoom;
    const lineCount = getParam(options, paramDefs, 'lineCount');
    const stepLength = 2;
    const stepsPerLine = getParam(options, paramDefs, 'stepsPerLine');
    const maxLineWidth = getParam(options, paramDefs, 'lineWidth');

    ctx.lineCap = 'round';

    for (let i = 0; i < lineCount; i++) {
      let x = rand() * width;
      let y = rand() * height;

      const colorIndex = Math.floor(rand() * fgColors.length);
      const color = fgColors[colorIndex];
      const alpha = 0.3 + rand() * 0.5;
      const lineWidth = 0.5 + rand() * maxLineWidth;

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
