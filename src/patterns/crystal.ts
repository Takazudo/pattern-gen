import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { darken, hexToRgb } from '../core/color-utils.js';
import { getParam } from '../core/param-utils.js';

const paramDefs: ParamDef[] = [
  {
    key: 'seedCount',
    label: 'Seed Count',
    type: 'slider',
    min: 5,
    max: 100,
    step: 1,
    defaultValue: 30,
  },
  {
    key: 'lightAngle',
    label: 'Light Angle',
    type: 'slider',
    min: 0,
    max: 360,
    step: 5,
    defaultValue: 233,
  },
  {
    key: 'edgeDarkening',
    label: 'Edge Darkening',
    type: 'slider',
    min: 0.05,
    max: 0.5,
    step: 0.05,
    defaultValue: 0.15,
  },
];

/**
 * Crystal / gem facet pattern — Voronoi cells with inner facet lines
 * from edge midpoints to cell centroid, plus shading for gem-like faceted look.
 */
export const crystal: PatternGenerator = {
  name: 'crystal',
  displayName: 'Crystal',
  description: 'Gem-like faceted Voronoi cells with inner shading and facet lines',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Generate seed points
    const seedCount = getParam(options, paramDefs, 'seedCount');
    const numSeeds = Math.max(8, Math.floor(seedCount * zoom * zoom));

    interface Seed {
      x: number;
      y: number;
      color: string;
      rgb: [number, number, number];
    }

    const seeds: Seed[] = [];
    for (let i = 0; i < numSeeds; i++) {
      const color = fgColors[i % fgColors.length];
      seeds.push({
        x: rand() * width,
        y: rand() * height,
        color,
        rgb: hexToRgb(color),
      });
    }

    // For each seed, collect its Voronoi cell boundary vertices
    // We'll use a scanline approach to find cell pixels, then draw facets with Canvas paths

    // Step 1: Assign each pixel to its nearest seed (build cell map)
    const cellMap = new Int32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minDist = Infinity;
        let closestIdx = 0;
        for (let i = 0; i < seeds.length; i++) {
          const dx = x - seeds[i].x;
          const dy = y - seeds[i].y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
          }
        }
        cellMap[y * width + x] = closestIdx;
      }
    }

    // Step 2: Find boundary edges between cells
    // For each cell, collect boundary midpoints and compute centroid
    const cellBounds: Map<
      number,
      { minX: number; minY: number; maxX: number; maxY: number; count: number; sumX: number; sumY: number }
    > = new Map();

    for (let i = 0; i < numSeeds; i++) {
      cellBounds.set(i, {
        minX: width,
        minY: height,
        maxX: 0,
        maxY: 0,
        count: 0,
        sumX: 0,
        sumY: 0,
      });
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = cellMap[y * width + x];
        const bounds = cellBounds.get(idx)!;
        bounds.sumX += x;
        bounds.sumY += y;
        bounds.count++;
        if (x < bounds.minX) bounds.minX = x;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }

    // Step 3: Precompute per-cell centroid and maxDist
    const cellCentroidX = new Float64Array(numSeeds);
    const cellCentroidY = new Float64Array(numSeeds);
    const cellMaxDist = new Float64Array(numSeeds);

    for (let i = 0; i < numSeeds; i++) {
      const bounds = cellBounds.get(i)!;
      if (bounds.count > 0) {
        cellCentroidX[i] = bounds.sumX / bounds.count;
        cellCentroidY[i] = bounds.sumY / bounds.count;
        cellMaxDist[i] = Math.max(
          bounds.maxX - bounds.minX,
          bounds.maxY - bounds.minY,
        ) / 2 || 1;
      }
    }

    // Step 4: For each cell, fill with faceted shading
    // Light direction from angle parameter
    const lightAngle = getParam(options, paramDefs, 'lightAngle');
    const lightRad = (lightAngle * Math.PI) / 180;
    // cos/sin already produce a unit vector — no need to normalize
    const lnX = Math.cos(lightRad);
    const lnY = Math.sin(lightRad);

    const edgeDarkenAmount = getParam(options, paramDefs, 'edgeDarkening');

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellIdx = cellMap[y * width + x];
        const seed = seeds[cellIdx];
        const centroidX = cellCentroidX[cellIdx];
        const centroidY = cellCentroidY[cellIdx];

        // Vector from centroid to pixel
        const dx = x - centroidX;
        const dy = y - centroidY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = cellMaxDist[cellIdx];

        // Normalize distance from centroid (0=center, 1=edge)
        const t = Math.min(1, dist / (maxDist || 1));

        // Facet normal approximation — direction from centroid
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : 0;

        // Light intensity based on facet angle
        const lightIntensity = Math.max(0, nx * lnX + ny * lnY);

        // Apply shading: center brighter, edges darker, plus light direction
        // Inline RGB math to avoid per-pixel hex parse/format
        const edgeDarken = edgeDarkenAmount * t;
        const lightBoost = 0.25 * lightIntensity * (1 - t * 0.5);
        const netBoost = lightBoost - edgeDarken;
        const [sr, sg, sb] = seed.rgb;

        let r: number, g: number, b: number;
        if (netBoost >= 0) {
          // lighten
          r = sr + (255 - sr) * netBoost;
          g = sg + (255 - sg) * netBoost;
          b = sb + (255 - sb) * netBoost;
        } else {
          // darken: factor = 1 + netBoost (netBoost is negative)
          const f = 1 + netBoost;
          r = sr * f;
          g = sg * f;
          b = sb * f;
        }
        const pixIdx = (y * width + x) * 4;
        data[pixIdx] = Math.max(0, Math.min(255, r));
        data[pixIdx + 1] = Math.max(0, Math.min(255, g));
        data[pixIdx + 2] = Math.max(0, Math.min(255, b));
        data[pixIdx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Step 4: Draw cell borders and facet lines
    ctx.lineWidth = Math.max(0.5, 1 / zoom);

    for (let i = 0; i < numSeeds; i++) {
      const seed = seeds[i];
      const bounds = cellBounds.get(i)!;
      if (bounds.count === 0) continue;

      const centroidX = bounds.sumX / bounds.count;
      const centroidY = bounds.sumY / bounds.count;
      const borderColor = darken(seed.color, 0.5);

      // Find boundary pixels and draw facet lines from edge midpoints to centroid
      // Sample boundary points at intervals
      const edgePoints: { x: number; y: number }[] = [];
      const step = Math.max(3, Math.floor(8 / zoom));

      for (let y = bounds.minY; y <= bounds.maxY; y += step) {
        for (let x = bounds.minX; x <= bounds.maxX; x += step) {
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          if (cellMap[y * width + x] !== i) continue;

          // Check if this is a boundary pixel
          let isBorder = false;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
              isBorder = true;
              break;
            }
            if (cellMap[ny * width + nx] !== i) {
              isBorder = true;
              break;
            }
          }
          if (isBorder) {
            edgePoints.push({ x, y });
          }
        }
      }

      // Draw facet lines from sampled edge midpoints to centroid
      ctx.strokeStyle = borderColor;
      ctx.globalAlpha = 0.4;
      const facetStep = Math.max(1, Math.floor(edgePoints.length / 8));
      for (let j = 0; j < edgePoints.length; j += facetStep) {
        ctx.beginPath();
        ctx.moveTo(centroidX, centroidY);
        ctx.lineTo(edgePoints[j].x, edgePoints[j].y);
        ctx.stroke();
      }

      // Draw cell borders
      ctx.strokeStyle = borderColor;
      ctx.globalAlpha = 0.6;
      for (const pt of edgePoints) {
        ctx.fillStyle = borderColor;
        ctx.fillRect(pt.x, pt.y, 1, 1);
      }
    }

    ctx.globalAlpha = 1;
  },
};
