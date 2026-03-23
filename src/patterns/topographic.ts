import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { createNoise2D, fbm } from '../core/noise.js';
import { hexToRgb } from '../core/color-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

const paramDefs: ParamDef[] = [
  { key: 'noiseScale', label: 'Noise Scale', type: 'slider', min: 0.001, max: 0.015, step: 0.001, defaultValue: 0.004 },
  { key: 'contourLevels', label: 'Contour Levels', type: 'slider', min: 4, max: 32, step: 1, defaultValue: 16 },
  { key: 'octaves', label: 'Octaves', type: 'slider', min: 2, max: 8, step: 1, defaultValue: 5 },
];

/**
 * Topographic pattern — Simplex noise rendered as contour lines.
 * Uses fbm for the height field, then draws isolines by detecting
 * threshold crossings between adjacent pixels.
 */
export const topographic: PatternGenerator = {
  name: 'topographic',
  displayName: 'Topographic',
  description: 'Contour map lines from simplex noise height field',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    // Seed-based randomization for visual diversity
    options = randomizeDefaults(options, paramDefs, options.rand, [
      'noiseScale', 'contourLevels', 'octaves',
    ]);

    const { width, height, rand, colorScheme, zoom } = options;
    const noise = createNoise2D(rand);

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const noiseScale = getParam(options, paramDefs, 'noiseScale') * zoom;
    const contourLevels = getParam(options, paramDefs, 'contourLevels');
    const octaves = getParam(options, paramDefs, 'octaves');
    const contourStep = 2 / contourLevels; // noise range is [-1, 1]

    // Seed-based noise offset for different terrain per seed
    const offsetX = rand() * 1000;
    const offsetY = rand() * 1000;

    // Seed-based color rotation for gradient direction diversity
    const colorRotation = Math.floor(rand() * fgColors.length);

    // Pre-compute height field
    const heightField = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        heightField[y * width + x] = fbm(noise, (x + offsetX) * noiseScale, (y + offsetY) * noiseScale, octaves, 2, 0.5);
      }
    }

    // Parse colors for pixel operations (with seed-based rotation)
    const rotatedFg = [...fgColors.slice(colorRotation), ...fgColors.slice(0, colorRotation)];
    const parsedFg = rotatedFg.map((c) => hexToRgb(c));

    // Draw contour lines using ImageData
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = heightField[y * width + x];
        const valRight = x < width - 1 ? heightField[y * width + x + 1] : val;
        const valDown = y < height - 1 ? heightField[(y + 1) * width + x] : val;

        // Check for contour crossings with neighbors
        const levelVal = Math.floor((val + 1) / contourStep);
        const levelRight = Math.floor((valRight + 1) / contourStep);
        const levelDown = Math.floor((valDown + 1) / contourStep);

        if (levelVal !== levelRight || levelVal !== levelDown) {
          // This pixel is on a contour line
          const colorIndex = ((levelVal % fgColors.length) + fgColors.length) % fgColors.length;
          const [r, g, b] = parsedFg[colorIndex];

          const idx = (y * width + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  },
};
