import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { hexToRgb, darken } from '../core/color-utils.js';

/**
 * Voronoi diagram pattern — classic cell decomposition from random seed points.
 * Each pixel is colored by its nearest seed point, with visible cell borders.
 */
export const voronoi: PatternGenerator = {
  name: 'voronoi',
  displayName: 'Voronoi',
  description: 'Classic Voronoi diagram with colored cells and visible borders',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Number of seed points scales with area and zoom
    const baseCount = Math.floor((width * height) / 4000);
    const numSeeds = Math.max(10, Math.floor(baseCount * zoom * zoom));

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
    const borderThreshold = 2.5 / zoom;

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
