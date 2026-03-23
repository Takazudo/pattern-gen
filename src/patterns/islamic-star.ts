import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { withAlpha, lighten } from '../core/color-utils.js';

/**
 * Islamic Star pattern — geometric star patterns with interlacing strands.
 * Creates a grid and constructs 6, 8, or 12-pointed stars by connecting
 * points at regular intervals around polygon centers with over-under crossings.
 */
export const islamicStar: PatternGenerator = {
  name: 'islamic-star',
  displayName: 'Islamic Star',
  description: 'Geometric star pattern with interlacing strands and over-under crossings',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Choose star type: 6, 8, or 12 points
    const starTypes = [6, 8, 12];
    const points = starTypes[Math.floor(rand() * starTypes.length)];

    // Pick 2-3 strand colors
    const shuffled = [...fgColors];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const numColors = 2 + Math.floor(rand() * 2);
    const strandColors = shuffled.slice(0, numColors);

    // Grid sizing
    const baseSize = Math.max(width, height) / 8;
    const cellSize = baseSize / zoom;
    const radius = cellSize * 0.42;
    const strandWidth = radius * 0.18;

    // Calculate grid extent
    const cols = Math.ceil(width / cellSize) + 2;
    const rows = Math.ceil(height / cellSize) + 2;
    const offsetX = (width - cols * cellSize) / 2;
    const offsetY = (height - rows * cellSize) / 2;

    // Draw decorative background rosette outlines
    ctx.strokeStyle = withAlpha(fgColors[fgColors.length - 1], 0.1);
    ctx.lineWidth = 1;
    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const cx = offsetX + col * cellSize + cellSize / 2;
        const cy = offsetY + row * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Strand data: collect all strands with crossing info
    interface Strand {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      order: number;
    }
    const strands: Strand[] = [];

    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const cx = offsetX + col * cellSize + cellSize / 2;
        const cy = offsetY + row * cellSize + cellSize / 2;

        // Generate star points
        const starPoints: { x: number; y: number }[] = [];
        for (let i = 0; i < points; i++) {
          const angle = (Math.PI * 2 * i) / points - Math.PI / 2;
          starPoints.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
          });
        }

        // Connect points by skipping — the skip determines the star shape
        const skip = points === 6 ? 2 : points === 8 ? 3 : 5;
        for (let i = 0; i < points; i++) {
          const from = starPoints[i];
          const to = starPoints[(i + skip) % points];
          const colorIdx = i % strandColors.length;
          strands.push({
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            color: strandColors[colorIdx],
            order: i % 2, // alternating over/under
          });
        }
      }
    }

    // Sort by order so "under" strands draw first
    strands.sort((a, b) => a.order - b.order);

    const underStrands = strands.filter((s) => s.order === 0);
    const overStrands = strands.filter((s) => s.order === 1);

    function drawStrand(strand: Strand): void {
      ctx.strokeStyle = strand.color;
      ctx.lineWidth = strandWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(strand.x1, strand.y1);
      ctx.lineTo(strand.x2, strand.y2);
      ctx.stroke();

      // Edge highlight
      ctx.strokeStyle = withAlpha(lighten(strand.color, 0.3), 0.4);
      ctx.lineWidth = strandWidth * 0.3;
      ctx.beginPath();
      ctx.moveTo(strand.x1, strand.y1);
      ctx.lineTo(strand.x2, strand.y2);
      ctx.stroke();
    }

    // Draw under strands first (no gap needed)
    for (const strand of underStrands) {
      drawStrand(strand);
    }

    // Draw over strands: cut a bg-colored gap through under strands, then draw on top
    for (const strand of overStrands) {
      ctx.strokeStyle = bg;
      ctx.lineWidth = strandWidth + 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(strand.x1, strand.y1);
      ctx.lineTo(strand.x2, strand.y2);
      ctx.stroke();

      drawStrand(strand);
    }

    // Draw small decorative circles at star centers
    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const cx = offsetX + col * cellSize + cellSize / 2;
        const cy = offsetY + row * cellSize + cellSize / 2;

        ctx.fillStyle = withAlpha(strandColors[0], 0.6);
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};
