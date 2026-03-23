import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { createNoise2D, fbm } from '../core/noise.js';
import { hexToRgb } from '../core/color-utils.js';
import { shuffleArray } from '../core/array-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

const paramDefs: ParamDef[] = [
  { key: 'noiseScale', label: 'Noise Scale', type: 'slider', min: 0.002, max: 0.015, step: 0.001, defaultValue: 0.005 },
  { key: 'veinFrequency', label: 'Vein Frequency', type: 'slider', min: 0.005, max: 0.1, step: 0.005, defaultValue: 0.02 },
  { key: 'turbulenceAmplitude', label: 'Turbulence Amplitude', type: 'slider', min: 1, max: 20, step: 0.5, defaultValue: 5 },
];

/**
 * Marble pattern — Marble veining using turbulent noise.
 * Uses the classic formula: sin(x * freq + turbulence(x, y) * amplitude)
 * with multiple turbulence layers for a realistic marble look.
 */
export const marble: PatternGenerator = {
  name: 'marble',
  displayName: 'Marble',
  description: 'Marble veining pattern using turbulent noise layers',
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
    const frequency = getParam(options, paramDefs, 'veinFrequency') * zoom;
    const turbulenceAmp = getParam(options, paramDefs, 'turbulenceAmplitude');

    // Random vein direction angle
    const angle = rand() * Math.PI;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    // Pre-parse colors
    const parsedBg = hexToRgb(bg);
    const parsedFg = fgColors.map((c) => hexToRgb(c));

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x * noiseScale;
        const ny = y * noiseScale;

        // Multiple turbulence layers
        const turb1 = fbm(noise, nx, ny, 6, 2, 0.5);
        const turb2 = fbm(noise, nx + 3.7, ny + 7.1, 4, 2, 0.5);

        // Project position along vein direction
        const projected = (x * dirX + y * dirY) * frequency;

        // Classic marble formula with combined turbulence
        const veinValue = Math.sin(projected + turb1 * turbulenceAmp + turb2 * turbulenceAmp * 0.5);

        // Map sin value [-1, 1] to color blend
        // Narrow veins: use a sharp function
        const normalized = (veinValue + 1) / 2; // 0-1
        const veinIntensity = Math.pow(normalized, 0.6);

        // Choose vein color based on turbulence
        const colorIdx = Math.abs(Math.floor(turb2 * parsedFg.length)) % parsedFg.length;
        const [fr, fg, fb] = parsedFg[colorIdx];

        // Blend between background and vein color
        const r = Math.round(parsedBg[0] + (fr - parsedBg[0]) * veinIntensity);
        const g = Math.round(parsedBg[1] + (fg - parsedBg[1]) * veinIntensity);
        const b = Math.round(parsedBg[2] + (fb - parsedBg[2]) * veinIntensity);

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  },
};
