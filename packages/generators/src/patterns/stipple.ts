import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { createNoise2D, fbm } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  {
    key: 'dotSpacing',
    label: 'Dot Spacing',
    type: 'slider',
    min: 3,
    max: 20,
    step: 1,
    defaultValue: 8,
  },
  {
    key: 'noiseScale',
    label: 'Noise Scale',
    type: 'slider',
    min: 0.001,
    max: 0.02,
    step: 0.001,
    defaultValue: 0.005,
  },
  {
    key: 'jitter',
    label: 'Jitter',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.6,
  },
];

/**
 * Weighted Voronoi stippling / dot-matrix effect.
 * Uses noise to create a density field and places dots of varying size
 * proportional to local density, creating a pointillist art effect.
 */
export const stipple: PatternGenerator = {
  name: 'stipple',
  displayName: 'Stipple',
  description: 'Pointillist dot-matrix pattern with noise-driven density variation',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const noise = createNoise2D(rand);

    // Grid spacing for dot placement
    const baseSpacing = getParam(options, paramDefs, 'dotSpacing');
    const spacing = baseSpacing / zoom;
    const maxRadius = spacing * 0.45;
    const minRadius = spacing * 0.08;

    // Noise scale for the density field
    const noiseScaleBase = getParam(options, paramDefs, 'noiseScale');
    const noiseScale = noiseScaleBase * zoom;

    // Jitter factor
    const jitter = getParam(options, paramDefs, 'jitter');

    // Place dots on a jittered grid
    const cols = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Grid position with jitter
        const x = col * spacing + (rand() - 0.5) * spacing * jitter;
        const y = row * spacing + (rand() - 0.5) * spacing * jitter;

        if (x < -maxRadius || x > width + maxRadius ||
            y < -maxRadius || y > height + maxRadius) continue;

        // Sample density from noise field
        const noiseVal = fbm(noise, x * noiseScale, y * noiseScale, 4);
        const density = (noiseVal + 1) / 2; // Normalize to 0-1

        // Map density to dot radius
        const radius = minRadius + density * (maxRadius - minRadius);

        // Skip very small dots
        if (radius < 0.5) continue;

        // Pick color based on position in noise field using a second noise sample
        const colorNoise = fbm(
          noise,
          x * noiseScale * 2 + 100,
          y * noiseScale * 2 + 100,
          2,
        );
        const colorIdx = Math.floor(
          ((colorNoise + 1) / 2) * fgColors.length,
        );
        const color = fgColors[Math.min(colorIdx, fgColors.length - 1)];

        // Draw dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};
