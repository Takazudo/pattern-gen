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
    const parsedFg = fgColors.length > 0 ? fgColors.map((c) => hexToRgb(c)) : [parsedBg];

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const noiseScale = (scale * 0.003) * zoom;

    // Adaptive step for performance on large canvases
    const step = Math.max(1, Math.round(Math.min(width, height) / 1200));

    const clamp = (v: number) => Math.max(0, Math.min(255, v));

    // Write a pixel block (step x step) at (px, py) with given RGB
    const writeBlock = (px: number, py: number, r: number, g: number, b: number) => {
      for (let dy = 0; dy < step && py + dy < height; dy++) {
        for (let dx = 0; dx < step && px + dx < width; dx++) {
          const idx = ((py + dy) * width + (px + dx)) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    };

    // Blend bg toward a fg color by amount + blend factor
    const blendColor = (fg: [number, number, number], amount: number, blend: number): [number, number, number] => [
      clamp(parsedBg[0] + amount + (fg[0] - parsedBg[0]) * blend),
      clamp(parsedBg[1] + amount + (fg[1] - parsedBg[1]) * blend),
      clamp(parsedBg[2] + amount + (fg[2] - parsedBg[2]) * blend),
    ];

    if (textureType === 0) {
      // Noise: raw grain texture
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const n = fbm(noise, x * noiseScale, y * noiseScale, 4, 2, 0.5);
          const [r, g, b] = blendColor(parsedFg[0], n * intensity, (n + 1) / 2 * 0.3);
          writeBlock(x, y, r, g, b);
        }
      }
    } else if (textureType === 1) {
      // Paper: low-frequency noise with warm color tinting
      const paperScale = noiseScale * 0.5;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const n1 = fbm(noise, x * paperScale, y * paperScale, 3, 2, 0.6);
          const n2 = fbm(noise, x * paperScale * 3 + 100, y * paperScale * 3 + 100, 2, 2, 0.5);
          const combined = n1 * 0.7 + n2 * 0.3;
          const [r, g, b] = blendColor(parsedFg[0], combined * intensity, (n1 + 1) / 2 * 0.2);
          writeBlock(x, y, r, g, b);
        }
      }
    } else {
      // Fabric: directional noise with cross-hatching effect
      const fabricScale = noiseScale * 0.8;
      const angle1 = rand() * Math.PI;
      const angle2 = angle1 + Math.PI / 2 + (rand() - 0.5) * 0.3;
      const cos1 = Math.cos(angle1);
      const sin1 = Math.sin(angle1);
      const cos2 = Math.cos(angle2);
      const sin2 = Math.sin(angle2);

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const proj1 = x * cos1 + y * sin1;
          const proj2 = x * cos2 + y * sin2;
          const n1 = fbm(noise, proj1 * fabricScale, y * fabricScale * 0.2, 3, 2, 0.5);
          const n2 = fbm(noise, x * fabricScale * 0.2, proj2 * fabricScale, 3, 2, 0.5);
          const combined = (n1 + n2) * 0.5;
          const colorIdx = (n1 - n2 + 1) / 2 > 0.5 ? 0 : Math.min(1, parsedFg.length - 1);
          const [r, g, b] = blendColor(parsedFg[colorIdx], combined * intensity, Math.abs(combined) * 0.25);
          writeBlock(x, y, r, g, b);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  },
};
