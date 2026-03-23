import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { lerpColor } from '../core/color-utils.js';

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'feedRate', label: 'Feed Rate', min: 0.01, max: 0.08, step: 0.001, defaultValue: 0.046 },
  { type: 'slider', key: 'killRate', label: 'Kill Rate', min: 0.03, max: 0.08, step: 0.001, defaultValue: 0.063 },
  { type: 'slider', key: 'iterations', label: 'Iterations', min: 500, max: 5000, step: 100, defaultValue: 2500 },
  { type: 'slider', key: 'gridSize', label: 'Grid Size', min: 40, max: 120, step: 5, defaultValue: 100 },
];

/**
 * Gray-Scott reaction-diffusion simulation.
 * Creates organic spots, stripes, and maze-like Turing patterns
 * by simulating two chemical species reacting and diffusing on a grid.
 */
export const reactionDiffusion: PatternGenerator = {
  name: 'reaction-diffusion',
  displayName: 'Reaction Diffusion',
  description: 'Gray-Scott reaction-diffusion — organic spots, stripes, and Turing patterns',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Grid size — cap at 120 to prevent performance issues at high zoom
    const baseGridSize = getParam(options, paramDefs, 'gridSize');
    const gridW = Math.min(120, Math.round(baseGridSize * zoom));
    const gridH = Math.min(120, Math.round(baseGridSize * zoom));

    // Gray-Scott parameters — chosen for interesting patterns
    const feed = getParam(options, paramDefs, 'feedRate');
    const kill = getParam(options, paramDefs, 'killRate');
    const dA = 1.0;
    const dB = 0.5;
    const dt = 1.0;

    // Initialize grids (use let for swapping)
    const size = gridW * gridH;
    let a = new Float32Array(size).fill(1);
    let b = new Float32Array(size).fill(0);
    let nextA = new Float32Array(size);
    let nextB = new Float32Array(size);

    // Seed random areas with chemical B
    const numSeeds = 3 + Math.floor(rand() * 5);
    for (let s = 0; s < numSeeds; s++) {
      const sx = Math.floor(rand() * gridW);
      const sy = Math.floor(rand() * gridH);
      const radius = 2 + Math.floor(rand() * 3);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            const nx = ((sx + dx) % gridW + gridW) % gridW;
            const ny = ((sy + dy) % gridH + gridH) % gridH;
            b[ny * gridW + nx] = 1;
          }
        }
      }
    }

    // Run simulation
    const iterations = getParam(options, paramDefs, 'iterations');
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
          const idx = y * gridW + x;
          const xm = ((x - 1) % gridW + gridW) % gridW;
          const xp = (x + 1) % gridW;
          const ym = ((y - 1) % gridH + gridH) % gridH;
          const yp = (y + 1) % gridH;

          // Laplacian (5-point stencil)
          const lapA = a[y * gridW + xm] + a[y * gridW + xp] +
                       a[ym * gridW + x] + a[yp * gridW + x] -
                       4 * a[idx];
          const lapB = b[y * gridW + xm] + b[y * gridW + xp] +
                       b[ym * gridW + x] + b[yp * gridW + x] -
                       4 * b[idx];

          const aVal = a[idx];
          const bVal = b[idx];
          const abb = aVal * bVal * bVal;

          nextA[idx] = aVal + (dA * lapA - abb + feed * (1 - aVal)) * dt;
          nextB[idx] = bVal + (dB * lapB + abb - (kill + feed) * bVal) * dt;

          // Clamp
          nextA[idx] = Math.max(0, Math.min(1, nextA[idx]));
          nextB[idx] = Math.max(0, Math.min(1, nextB[idx]));
        }
      }
      // Swap references instead of copying
      [a, nextA] = [nextA, a];
      [b, nextB] = [nextB, b];
    }

    // Render: map concentration of B to colors
    const cellW = width / gridW;
    const cellH = height / gridH;

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const bVal = b[y * gridW + x];
        // Map bVal to palette index
        const colorIdx = Math.min(
          fgColors.length - 1,
          Math.floor(bVal * fgColors.length),
        );
        const t = (bVal * fgColors.length) - colorIdx;
        const nextIdx = Math.min(fgColors.length - 1, colorIdx + 1);

        // Interpolate between adjacent palette colors
        if (bVal < 0.05) {
          ctx.fillStyle = bg;
        } else {
          ctx.fillStyle = lerpColor(fgColors[colorIdx], fgColors[nextIdx], t);
        }

        ctx.fillRect(
          Math.floor(x * cellW),
          Math.floor(y * cellH),
          Math.ceil(cellW) + 1,
          Math.ceil(cellH) + 1,
        );
      }
    }
  },
};
