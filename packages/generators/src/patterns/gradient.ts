import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  {
    type: 'select',
    key: 'gradientType',
    label: 'Gradient Type',
    options: [
      { value: 0, label: 'Linear' },
      { value: 1, label: 'Radial' },
    ],
    defaultValue: 0,
  },
  { type: 'slider', key: 'angle', label: 'Angle', min: 0, max: 360, step: 15, defaultValue: 135 },
  { type: 'slider', key: 'colorStops', label: 'Color Stops', min: 2, max: 5, step: 1, defaultValue: 3 },
];

/**
 * Gradient — linear or radial gradient using palette colors.
 * Stop positions are slightly jittered via options.rand for an organic feel.
 */
export const gradient: PatternGenerator = {
  name: 'gradient',
  displayName: 'Gradient',
  description: 'Linear or radial gradient using colors from the active palette',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const gradientType = getParam(options, paramDefs, 'gradientType');
    const angle = getParam(options, paramDefs, 'angle');
    const colorStops = getParam(options, paramDefs, 'colorStops');

    // Gather colors: palette[0] as first, then shuffled fg colors
    const colors = [colorScheme.palette[0], ...shuffleArray(colorScheme.palette.slice(1), rand)];
    const stopCount = Math.min(colorStops, colors.length);

    let grad: CanvasGradient;

    if (gradientType === 0) {
      // Linear gradient
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Project from center to edges along the angle
      const halfDiag = Math.sqrt(width * width + height * height) / 2;
      const cx = width / 2;
      const cy = height / 2;
      grad = ctx.createLinearGradient(
        cx - cos * halfDiag,
        cy - sin * halfDiag,
        cx + cos * halfDiag,
        cy + sin * halfDiag,
      );
    } else {
      // Radial gradient from center
      const maxRadius = Math.sqrt(width * width + height * height) / 2;
      grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, maxRadius);
    }

    // Add color stops with slight jitter for organic feel
    for (let i = 0; i < stopCount; i++) {
      const basePosition = stopCount > 1 ? i / (stopCount - 1) : 0;
      // Jitter middle stops slightly (keep first and last at 0 and 1)
      let position = basePosition;
      if (i > 0 && i < stopCount - 1) {
        const jitter = (rand() - 0.5) * 0.1;
        position = Math.max(0.01, Math.min(0.99, basePosition + jitter));
      }
      grad.addColorStop(position, colors[i % colors.length]);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  },
};
