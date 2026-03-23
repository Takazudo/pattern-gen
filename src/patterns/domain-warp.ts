import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { createNoise2D, fbm } from '../core/noise.js';
import { hexToRgb } from '../core/color-utils.js';
import { shuffleArray } from '../core/array-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

const paramDefs: ParamDef[] = [
  { key: 'noiseScale', label: 'Noise Scale', type: 'slider', min: 0.001, max: 0.02, step: 0.001, defaultValue: 0.004 },
  { key: 'warpStrength', label: 'Warp Strength', type: 'slider', min: 20, max: 200, step: 5, defaultValue: 80 },
  { key: 'octaves', label: 'Octaves', type: 'slider', min: 2, max: 8, step: 1, defaultValue: 4 },
];

/**
 * Domain Warp pattern — Layered noise with domain warping.
 * Feed the output of one noise call as input coordinates to another,
 * creating swirling, psychedelic organic shapes rendered as filled regions.
 */
export const domainWarp: PatternGenerator = {
  name: 'domain-warp',
  displayName: 'Domain Warp',
  description: 'Layered noise with domain warping creating swirling organic shapes',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);
    const noise = createNoise2D(rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const noiseScale = getParam(options, paramDefs, 'noiseScale') * zoom;
    const warpStrength = getParam(options, paramDefs, 'warpStrength') / zoom;
    const octaves = getParam(options, paramDefs, 'octaves');

    // Render pixel-by-pixel using ImageData for performance
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Pre-parse palette colors
    const parsedColors = [bg, ...fgColors].map((hex) => hexToRgb(hex));

    const step = 2;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const nx = x * noiseScale;
        const ny = y * noiseScale;

        // First warp layer
        const warpX = fbm(noise, nx, ny, octaves) * warpStrength * noiseScale;
        const warpY = fbm(noise, nx + 5.2, ny + 1.3, octaves) * warpStrength * noiseScale;

        // Second warp layer (domain warp)
        const warpX2 = fbm(noise, nx + warpX + 1.7, ny + warpY + 9.2, octaves) * warpStrength * noiseScale;
        const warpY2 = fbm(noise, nx + warpX + 8.3, ny + warpY + 2.8, octaves) * warpStrength * noiseScale;

        // Final value
        const val = fbm(noise, nx + warpX2, ny + warpY2, octaves);

        // Map to color index (normalize from [-1,1] to [0, numColors-1])
        const normalized = (val + 1) / 2;
        const colorIdx = Math.floor(normalized * (parsedColors.length - 1));
        const clampedIdx = Math.max(0, Math.min(parsedColors.length - 1, colorIdx));
        const [r, g, b] = parsedColors[clampedIdx];

        // Fill the step x step block
        for (let dy = 0; dy < step && y + dy < height; dy++) {
          for (let dx = 0; dx < step && x + dx < width; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  },
};
