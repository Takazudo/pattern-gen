import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { hexToRgb } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'shapeCount', label: 'Shape Count', min: 3, max: 15, step: 1, defaultValue: 7 },
  { type: 'slider', key: 'opacity', label: 'Opacity', min: 0.05, max: 0.4, step: 0.05, defaultValue: 0.15 },
  { type: 'slider', key: 'blurLayers', label: 'Blur Layers', min: 1, max: 5, step: 1, defaultValue: 3 },
];

/**
 * Glass — glassmorphism-inspired pattern with layered translucent shapes.
 * Simulates frosted glass effect using overlapping semi-transparent rounded
 * rectangles and a noise overlay, since canvas can't do real backdrop-filter blur.
 */
export const glass: PatternGenerator = {
  name: 'glass',
  displayName: 'Glass',
  description: 'Glassmorphism-inspired translucent layered shapes with frosted effect',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const shapeCount = getParam(options, paramDefs, 'shapeCount');
    const opacity = getParam(options, paramDefs, 'opacity');
    const blurLayers = getParam(options, paramDefs, 'blurLayers');

    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = shuffleArray(palette.slice(1), rand);

    // Base gradient background
    const bgRgb = hexToRgb(bg);
    const fgRgb = hexToRgb(fgColors.length > 0 ? fgColors[0] : bg);
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`);
    grad.addColorStop(1, `rgb(${fgRgb[0]},${fgRgb[1]},${fgRgb[2]})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Draw translucent rounded rectangles
    const minDim = Math.min(width, height);
    const baseSize = (minDim * 0.3) / zoom;

    for (let i = 0; i < shapeCount; i++) {
      const color = fgColors.length > 0 ? fgColors[i % fgColors.length] : bg;
      const [r, g, b] = hexToRgb(color);

      const rectW = baseSize * (0.5 + rand() * 1.5);
      const rectH = baseSize * (0.5 + rand() * 1.5);
      const x = rand() * (width - rectW * 0.5) - rectW * 0.25;
      const y = rand() * (height - rectH * 0.5) - rectH * 0.25;
      const cornerRadius = Math.min(rectW, rectH) * (0.1 + rand() * 0.2);

      // Draw multiple slightly offset layers for blur simulation
      for (let layer = 0; layer < blurLayers; layer++) {
        const layerExpand = layer * 3;
        const layerOpacity = opacity / (layer + 1);

        ctx.fillStyle = `rgba(${r},${g},${b},${layerOpacity})`;
        ctx.beginPath();
        ctx.roundRect(
          x - layerExpand,
          y - layerExpand,
          rectW + layerExpand * 2,
          rectH + layerExpand * 2,
          cornerRadius + layerExpand,
        );
        ctx.fill();
      }

      // Inner shape with slightly higher opacity for glass panel effect
      ctx.fillStyle = `rgba(${r},${g},${b},${opacity * 1.5})`;
      ctx.beginPath();
      ctx.roundRect(x, y, rectW, rectH, cornerRadius);
      ctx.fill();

      // Subtle highlight on top edge
      const highlightGrad = ctx.createLinearGradient(x, y, x, y + rectH * 0.3);
      highlightGrad.addColorStop(0, `rgba(255,255,255,${opacity * 0.8})`);
      highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = highlightGrad;
      ctx.beginPath();
      ctx.roundRect(x, y, rectW, rectH, cornerRadius);
      ctx.fill();
    }

    // Noise overlay for frosted effect
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const noiseAmount = 15;
    const step = Math.max(1, Math.round(minDim / 1200));

    for (let py = 0; py < height; py += step) {
      for (let px = 0; px < width; px += step) {
        const noise = (rand() - 0.5) * noiseAmount;
        for (let dy = 0; dy < step && py + dy < height; dy++) {
          for (let dx = 0; dx < step && px + dx < width; dx++) {
            const idx = ((py + dy) * width + (px + dx)) * 4;
            data[idx] = Math.max(0, Math.min(255, data[idx] + noise));
            data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + noise));
            data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + noise));
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  },
};
