import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { hexToRgb, darken } from '../core/color-utils.js';
import { getParam } from '../core/param-utils.js';

const paramDefs: ParamDef[] = [
  {
    key: 'seedCount',
    label: 'Seed Count',
    type: 'slider',
    min: 5,
    max: 200,
    step: 1,
    defaultValue: 40,
  },
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 0.5,
    max: 8,
    step: 0.5,
    defaultValue: 2.5,
  },
];

/**
 * Voronoi diagram pattern — classic cell decomposition from random seed points.
 * Each pixel is colored by its nearest seed point, with visible cell borders.
 */
export const voronoi: PatternGenerator = {
  name: 'voronoi',
  displayName: 'Voronoi',
  description: 'Classic Voronoi diagram with colored cells and visible borders',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Number of seed points scales with area and zoom
    const seedCount = getParam(options, paramDefs, 'seedCount');
    const numSeeds = Math.max(10, Math.floor(seedCount * zoom * zoom));

    // Generate seed points
    const seeds: { x: number; y: number; color: string }[] = [];
    for (let i = 0; i < numSeeds; i++) {
      seeds.push({
        x: rand() * width,
        y: rand() * height,
        color: fgColors[i % fgColors.length],
      });
    }

    // Border thickness in pixels
    const borderWidth = getParam(options, paramDefs, 'borderWidth');
    const borderThreshold = borderWidth / zoom;

    // Use ImageData for pixel-level rendering
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Parse border color once
    const borderColor = darken(bg, 0.5);
    const [borderR, borderG, borderB] = hexToRgb(borderColor);

    // Pre-parse seed colors
    const seedRgb = seeds.map((s) => hexToRgb(s.color));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minDist = Infinity;
        let secondMinDist = Infinity;
        let closestIdx = 0;

        for (let i = 0; i < seeds.length; i++) {
          const dx = x - seeds[i].x;
          const dy = y - seeds[i].y;
          const dist = dx * dx + dy * dy;

          if (dist < minDist) {
            secondMinDist = minDist;
            minDist = dist;
            closestIdx = i;
          } else if (dist < secondMinDist) {
            secondMinDist = dist;
          }
        }

        const idx = (y * width + x) * 4;
        const d1 = Math.sqrt(minDist);
        const d2 = Math.sqrt(secondMinDist);
        const borderDist = d2 - d1;

        if (borderDist < borderThreshold) {
          // Border pixel
          data[idx] = borderR;
          data[idx + 1] = borderG;
          data[idx + 2] = borderB;
          data[idx + 3] = 255;
        } else {
          // Cell interior
          const [r, g, b] = seedRgb[closestIdx];
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
