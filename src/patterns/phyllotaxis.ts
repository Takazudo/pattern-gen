import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { withAlpha } from '../core/color-utils.js';

/**
 * Fibonacci spiral dot arrangement (sunflower pattern).
 * Places dots using the golden angle, creating the characteristic
 * spiral pattern seen in sunflower seed heads.
 */
export const phyllotaxis: PatternGenerator = {
  name: 'phyllotaxis',
  displayName: 'Phyllotaxis',
  description: 'Fibonacci spiral dot arrangement — sunflower seed head pattern',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.508 degrees in radians

    // Number of dots and spacing factor
    const numDots = Math.floor(800 * zoom);
    const maxRadius = Math.min(width, height) * 0.45;
    const c = maxRadius / Math.sqrt(numDots); // Spacing constant

    // Random offset for variation
    const angleOffset = rand() * Math.PI * 2;
    const colorMode = rand(); // Determines color assignment strategy

    for (let n = 1; n <= numDots; n++) {
      const r = c * Math.sqrt(n);
      const theta = n * goldenAngle + angleOffset;

      const x = centerX + r * Math.cos(theta);
      const y = centerY + r * Math.sin(theta);

      // Skip dots outside canvas
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;

      // Dot size: smaller near center, larger at edges
      const normalizedR = r / maxRadius;
      const dotRadius = (1.5 + normalizedR * 4) * (1 / zoom);

      // Color: based on angle or radius depending on mode
      let colorIdx: number;
      if (colorMode < 0.5) {
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
