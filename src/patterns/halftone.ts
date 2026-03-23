import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { createNoise2D, fbm } from '../core/noise.js';
import { hexToRgb } from '../core/color-utils.js';

/**
 * CMYK-style halftone dots.
 * Creates a noise-based "image" rendered as a grid of dots where dot size
 * represents brightness. Each color channel's dot grid is rotated slightly,
 * mimicking real CMYK printing.
 */
export const halftone: PatternGenerator = {
  name: 'halftone',
  displayName: 'Halftone',
  description: 'CMYK-style halftone dots — noise-based image rendered as sized dot grids',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = palette.slice(1);
    const noise = createNoise2D(rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Dot grid spacing
    const dotSpacing = (8 + rand() * 6) / zoom; // 8-14px
    const maxDotRadius = dotSpacing * 0.45;
    const noiseScale = 0.004 * zoom;

    // Use 2-3 palette colors as channels, each with a slight rotation
    const numChannels = 2 + Math.floor(rand() * 2);
    const channels: { color: string; angle: number }[] = [];
    const baseAngle = rand() * Math.PI;
    for (let i = 0; i < numChannels; i++) {
      channels.push({
        color: fgColors[i % fgColors.length],
        angle: baseAngle + (i * Math.PI) / (numChannels * 2.5) + (rand() * 0.1 - 0.05),
      });
    }

    const diagonal = Math.sqrt(width * width + height * height);
    const gridExtent = Math.ceil(diagonal / dotSpacing) + 2;

    for (const channel of channels) {
      const [cr, cg, cb] = hexToRgb(channel.color);
      const cosA = Math.cos(channel.angle);
      const sinA = Math.sin(channel.angle);
      const channelFill = `rgba(${cr},${cg},${cb},0.6)`;

      for (let gy = -Math.floor(gridExtent / 2); gy <= Math.floor(gridExtent / 2); gy++) {
        for (let gx = -Math.floor(gridExtent / 2); gx <= Math.floor(gridExtent / 2); gx++) {
          // Rotate grid point back to canvas space
          const localX = gx * dotSpacing;
          const localY = gy * dotSpacing;
          const canvasX = width / 2 + localX * cosA - localY * sinA;
          const canvasY = height / 2 + localX * sinA + localY * cosA;

          // Skip dots outside canvas
          if (canvasX < -maxDotRadius || canvasX > width + maxDotRadius ||
              canvasY < -maxDotRadius || canvasY > height + maxDotRadius) continue;

          // Sample noise at this position for brightness
          const noiseVal = fbm(noise, canvasX * noiseScale, canvasY * noiseScale, 3);
          const brightness = (noiseVal + 1) / 2; // 0-1

          // Dot radius proportional to brightness
          const dotRadius = maxDotRadius * brightness;

          if (dotRadius > 0.3) {
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = channelFill;
            ctx.fill();
          }
        }
      }
    }
  },
};
