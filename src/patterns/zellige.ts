import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { hexToRgb, rgbToHex, darken, lighten, withAlpha } from '../core/color-utils.js';
import { createNoise2D } from '../core/noise.js';

/**
 * Zellige pattern — Moroccan mosaic tiles with irregular polygonal shapes,
 * visible grout lines, and subtle color variation simulating glazed ceramic.
 */
export const zellige: PatternGenerator = {
  name: 'zellige',
  displayName: 'Zellige',
  description: 'Moroccan mosaic tiles with hand-cut irregular shapes and glazed ceramic finish',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);
    const noise = createNoise2D(rand);

    // Grout color — dark version of background
    const groutColor = darken(bg, 0.4);

    // Fill with grout color (visible between tiles)
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, width, height);

    // Grid sizing for tile layout
    const baseSize = Math.max(width, height) / 16;
    const cellSize = baseSize / zoom;
    const groutWidth = Math.max(1.5, cellSize * 0.06);

    const cols = Math.ceil(width / cellSize) + 2;
    const rows = Math.ceil(height / cellSize) + 2;

    // Generate jittered grid points
    const jitter = cellSize * 0.2;
    const points: { x: number; y: number }[][] = [];

    for (let row = -1; row <= rows + 1; row++) {
      points[row + 1] = [];
      for (let col = -1; col <= cols + 1; col++) {
        points[row + 1][col + 1] = {
          x: col * cellSize + (rand() - 0.5) * jitter,
          y: row * cellSize + (rand() - 0.5) * jitter,
        };
      }
    }

    // Draw tiles as irregular quadrilaterals from the jittered grid
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const tl = points[row][col];
        const tr = points[row][col + 1];
        const br = points[row + 1][col + 1];
        const bl = points[row + 1][col];

        if (!tl || !tr || !br || !bl) continue;

        // Pick a tile color from palette
        const colorIdx = Math.floor(rand() * fgColors.length);
        const baseColor = fgColors[colorIdx];

        // Subtle per-tile color variation for glazed ceramic feel
        const [r, g, b] = hexToRgb(baseColor);
        const variation = 0.9 + rand() * 0.2;
        const noiseVal = noise(
          (tl.x + tr.x) * 0.01,
          (tl.y + bl.y) * 0.01,
        );
        const noiseMod = 1 + noiseVal * 0.08;
        const tileColor = rgbToHex(
          r * variation * noiseMod,
          g * variation * noiseMod,
          b * variation * noiseMod,
        );

        // Inset the tile slightly to show grout
        const insetFactor = groutWidth / cellSize;
        const cx = (tl.x + tr.x + br.x + bl.x) / 4;
        const cy = (tl.y + tr.y + br.y + bl.y) / 4;

        const inset = (p: { x: number; y: number }) => ({
          x: p.x + (cx - p.x) * insetFactor,
          y: p.y + (cy - p.y) * insetFactor,
        });

        const itl = inset(tl);
        const itr = inset(tr);
        const ibr = inset(br);
        const ibl = inset(bl);

        // Draw tile
        ctx.beginPath();
        ctx.moveTo(itl.x, itl.y);
        ctx.lineTo(itr.x, itr.y);
        ctx.lineTo(ibr.x, ibr.y);
        ctx.lineTo(ibl.x, ibl.y);
        ctx.closePath();
        ctx.fillStyle = tileColor;
        ctx.fill();

        // Glaze highlight — subtle light reflection on upper portion
        const gradient = ctx.createLinearGradient(
          cx, itl.y,
          cx, ibr.y,
        );
        gradient.addColorStop(0, withAlpha(lighten(tileColor, 0.3), 0.25));
        gradient.addColorStop(0.5, withAlpha(tileColor, 0));
        gradient.addColorStop(1, withAlpha(darken(tileColor, 0.7), 0.15));

        ctx.beginPath();
        ctx.moveTo(itl.x, itl.y);
        ctx.lineTo(itr.x, itr.y);
        ctx.lineTo(ibr.x, ibr.y);
        ctx.lineTo(ibl.x, ibl.y);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Edge highlights for 3D effect
        ctx.strokeStyle = withAlpha(lighten(tileColor, 0.4), 0.3);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(itl.x, itl.y);
        ctx.lineTo(itr.x, itr.y);
        ctx.stroke();

        ctx.strokeStyle = withAlpha(darken(tileColor, 0.5), 0.3);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(ibr.x, ibr.y);
        ctx.lineTo(ibl.x, ibl.y);
        ctx.stroke();
      }
    }

    // Add occasional tiny imperfections (chips in the glaze)
    const numChips = Math.floor(width * height * 0.00003);
    for (let i = 0; i < numChips; i++) {
      const chipX = rand() * width;
      const chipY = rand() * height;
      const chipSize = 1 + rand() * 2;
      ctx.fillStyle = withAlpha(groutColor, 0.4);
      ctx.beginPath();
      ctx.arc(chipX, chipY, chipSize, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
