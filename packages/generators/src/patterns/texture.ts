import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { createNoise2D, fbm } from '@takazudo/pattern-gen-core';
import { hexToRgb } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  {
    type: 'select',
    key: 'textureType',
    label: 'Texture Type',
    options: [
      { value: 0, label: 'Noise' },
      { value: 1, label: 'Paper' },
      { value: 2, label: 'Fabric' },
    ],
    defaultValue: 0,
  },
  { type: 'slider', key: 'intensity', label: 'Intensity', min: 5, max: 80, step: 5, defaultValue: 25 },
  { type: 'slider', key: 'scale', label: 'Scale', min: 1, max: 10, step: 1, defaultValue: 3 },
];

/**
 * Texture — subtle noise-based texture patterns.
 * Three variants: Noise (raw grain), Paper (warm low-frequency), Fabric (directional cross-hatch).
 */
export const texture: PatternGenerator = {
  name: 'texture',
  displayName: 'Texture',
  description: 'Subtle noise-based textures — noise grain, paper, or fabric',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);
    const noise = createNoise2D(rand);

    const textureType = getParam(options, paramDefs, 'textureType');
    const intensity = getParam(options, paramDefs, 'intensity');
    const scale = getParam(options, paramDefs, 'scale');

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);
    const parsedBg = hexToRgb(bg);
    const parsedFg = fgColors.map((c) => hexToRgb(c));

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const noiseScale = (scale * 0.003) * zoom;

    // Adaptive step for performance on large canvases
    const step = Math.max(1, Math.round(Math.min(width, height) / 1200));

    if (textureType === 0) {
      // Noise: raw grain texture
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const n = fbm(noise, x * noiseScale, y * noiseScale, 4, 2, 0.5);
          const amount = n * intensity;
          // Tint with first fg color
          const colorBlend = (n + 1) / 2 * 0.3; // subtle color tinting
          const r = Math.max(0, Math.min(255, parsedBg[0] + amount + (parsedFg[0][0] - parsedBg[0]) * colorBlend));
          const g = Math.max(0, Math.min(255, parsedBg[1] + amount + (parsedFg[0][1] - parsedBg[1]) * colorBlend));
          const b = Math.max(0, Math.min(255, parsedBg[2] + amount + (parsedFg[0][2] - parsedBg[2]) * colorBlend));

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
    } else if (textureType === 1) {
      // Paper: low-frequency noise with warm color tinting
      const paperScale = noiseScale * 0.5; // lower frequency for smoother paper
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const n1 = fbm(noise, x * paperScale, y * paperScale, 3, 2, 0.6);
          const n2 = fbm(noise, x * paperScale * 3 + 100, y * paperScale * 3 + 100, 2, 2, 0.5);

          // Combine low and high frequency for paper fiber effect
          const combined = n1 * 0.7 + n2 * 0.3;
          const amount = combined * intensity;

          // Warm tint toward first palette fg color
          const warmth = (n1 + 1) / 2 * 0.2;
          const r = Math.max(0, Math.min(255, parsedBg[0] + amount + (parsedFg[0][0] - parsedBg[0]) * warmth));
          const g = Math.max(0, Math.min(255, parsedBg[1] + amount + (parsedFg[0][1] - parsedBg[1]) * warmth));
          const b = Math.max(0, Math.min(255, parsedBg[2] + amount + (parsedFg[0][2] - parsedBg[2]) * warmth));

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
    } else {
      // Fabric: directional noise with cross-hatching effect
      const fabricScale = noiseScale * 0.8;
      const angle1 = rand() * Math.PI; // warp direction
      const angle2 = angle1 + Math.PI / 2 + (rand() - 0.5) * 0.3; // weft direction (roughly perpendicular)
      const cos1 = Math.cos(angle1);
      const sin1 = Math.sin(angle1);
      const cos2 = Math.cos(angle2);
      const sin2 = Math.sin(angle2);

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          // Two directional noise layers for warp and weft
          const proj1 = x * cos1 + y * sin1;
          const proj2 = x * cos2 + y * sin2;

          const n1 = fbm(noise, proj1 * fabricScale, y * fabricScale * 0.2, 3, 2, 0.5);
          const n2 = fbm(noise, x * fabricScale * 0.2, proj2 * fabricScale, 3, 2, 0.5);

          // Cross-hatch: combine both directions
          const combined = (n1 + n2) * 0.5;
          const amount = combined * intensity;

          // Color based on which direction dominates
          const balance = (n1 - n2 + 1) / 2; // 0-1
          const colorIdx = balance > 0.5 ? 0 : Math.min(1, parsedFg.length - 1);
          const fg = parsedFg[colorIdx];
          const blend = Math.abs(combined) * 0.25;

          const r = Math.max(0, Math.min(255, parsedBg[0] + amount + (fg[0] - parsedBg[0]) * blend));
          const g = Math.max(0, Math.min(255, parsedBg[1] + amount + (fg[1] - parsedBg[1]) * blend));
          const b = Math.max(0, Math.min(255, parsedBg[2] + amount + (fg[2] - parsedBg[2]) * blend));

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
    }

    ctx.putImageData(imageData, 0, 0);
  },
};
