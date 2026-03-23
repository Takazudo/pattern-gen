import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { hexToRgb, lerpColor } from '../core/color-utils.js';
import { getParam } from '../core/param-utils.js';

const paramDefs: ParamDef[] = [
  {
    key: 'cellSize',
    label: 'Cell Size',
    type: 'slider',
    min: 10,
    max: 150,
    step: 5,
    defaultValue: 80,
  },
  {
    key: 'f1Weight',
    label: 'F1 Weight',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.4,
  },
  {
    key: 'f2Weight',
    label: 'F2 Weight',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.6,
  },
];

/**
 * Worley (cellular) noise pattern — renders distance values from random seed points.
 * Uses F1 and F2-F1 distances to create stone wall / cracked earth textures.
 */
export const worley: PatternGenerator = {
  name: 'worley',
  displayName: 'Worley',
  description: 'Cellular noise creating stone wall and cracked earth textures',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Read params
    const f1Weight = getParam(options, paramDefs, 'f1Weight');
    const f2Weight = getParam(options, paramDefs, 'f2Weight');

    // Grid-based approach for efficient nearest-neighbor lookup
    const cellSize = Math.max(30, Math.floor(getParam(options, paramDefs, 'cellSize') / zoom));
    const gridCols = Math.ceil(width / cellSize) + 2;
    const gridRows = Math.ceil(height / cellSize) + 2;

    // Generate one seed point per grid cell (with jitter), stored in a 2D grid
    // Grid indices offset by 1 so grid cell (-1,-1) maps to index (0,0)
    const grid: { x: number; y: number }[][] = [];
    for (let gy = -1; gy < gridRows; gy++) {
      const row: { x: number; y: number }[] = [];
      for (let gx = -1; gx < gridCols; gx++) {
        row.push({
          x: (gx + rand()) * cellSize,
          y: (gy + rand()) * cellSize,
        });
      }
      grid.push(row);
    }

    // Find max possible distance for normalization
    const maxDist = cellSize * 1.5;

    // Build gradient from palette colors
    const gradientStops = [bg, ...fgColors.slice(0, 4)];

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let f1 = Infinity;
        let f2 = Infinity;

        // Determine which grid cell this pixel belongs to, then search 3x3 neighborhood
        const gcx = Math.floor(x / cellSize) + 1; // +1 for the -1 offset
        const gcy = Math.floor(y / cellSize) + 1;

        for (let dy = -1; dy <= 1; dy++) {
          const ry = gcy + dy;
          if (ry < 0 || ry >= grid.length) continue;
          const row = grid[ry];
          for (let dx = -1; dx <= 1; dx++) {
            const rx = gcx + dx;
            if (rx < 0 || rx >= row.length) continue;
            const seed = row[rx];
            const sdx = x - seed.x;
            const sdy = y - seed.y;
            const dist = Math.sqrt(sdx * sdx + sdy * sdy);

            if (dist < f1) {
              f2 = f1;
              f1 = dist;
            } else if (dist < f2) {
              f2 = dist;
            }
          }
        }

        // Use F2 - F1 for prominent cell borders
        const edgeValue = Math.min(1, (f2 - f1) / maxDist);
        // Use F1 for distance gradient within cells
        const distValue = Math.min(1, f1 / maxDist);

        // Blend: use edgeValue for border prominence, distValue for inner shading
        const t = edgeValue * f2Weight + distValue * f1Weight;

        // Map t to gradient
        const gradientPos = t * (gradientStops.length - 1);
        const stopIdx = Math.min(
          Math.floor(gradientPos),
          gradientStops.length - 2,
        );
        const stopT = gradientPos - stopIdx;
        const color = lerpColor(
          gradientStops[stopIdx],
          gradientStops[stopIdx + 1],
          stopT,
        );

        const [r, g, b] = hexToRgb(color);
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
