import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { withAlpha } from '../core/color-utils.js';
import { shuffleArray } from '../core/array-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'dotCount', label: 'Dot Count', min: 100, max: 3000, step: 50, defaultValue: 800 },
  { type: 'slider', key: 'dotScale', label: 'Dot Scale', min: 0.5, max: 5, step: 0.25, defaultValue: 2 },
  { type: 'select', key: 'colorMode', label: 'Color Mode', options: [{ value: 0, label: 'By Angle' }, { value: 1, label: 'By Radius' }], defaultValue: 0 },
];

/**
 * Fibonacci spiral dot arrangement (sunflower pattern).
 * Places dots using the golden angle, creating the characteristic
 * spiral pattern seen in sunflower seed heads.
 */
export const phyllotaxis: PatternGenerator = {
  name: 'phyllotaxis',
  displayName: 'Phyllotaxis',
  description: 'Fibonacci spiral dot arrangement — sunflower seed head pattern',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);
    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = shuffleArray(palette.slice(1), rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.508 degrees in radians

    // Number of dots and spacing factor
    const numDots = Math.floor(getParam(options, paramDefs, 'dotCount') * zoom);
    const maxRadius = Math.min(width, height) * 0.45;
    const c = maxRadius / Math.sqrt(numDots); // Spacing constant

    // Random offset for variation
    const angleOffset = rand() * Math.PI * 2;
    const colorModeValue = getParam(options, paramDefs, 'colorMode');
    const dotScale = getParam(options, paramDefs, 'dotScale');

    for (let n = 1; n <= numDots; n++) {
      const r = c * Math.sqrt(n);
      const theta = n * goldenAngle + angleOffset;

      const x = centerX + r * Math.cos(theta);
      const y = centerY + r * Math.sin(theta);

      // Skip dots outside canvas
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;

      // Dot size: smaller near center, larger at edges
      const normalizedR = r / maxRadius;
      const dotRadius = (1.5 + normalizedR * 4) * (dotScale / 2) * (1 / zoom);

      // Color: based on angle or radius depending on mode
      let colorIdx: number;
      if (colorModeValue === 0) {
        // Color by angle
        const normalizedAngle = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        colorIdx = Math.floor((normalizedAngle / (Math.PI * 2)) * fgColors.length) % fgColors.length;
      } else {
        // Color by radius
        colorIdx = Math.floor(normalizedR * fgColors.length) % fgColors.length;
      }

      // Slight alpha variation for depth
      const alpha = 0.7 + normalizedR * 0.3;

      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(fgColors[colorIdx], alpha);
      ctx.fill();
    }
  },
};
