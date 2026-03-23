import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { withAlpha, darken, lighten } from '../core/color-utils.js';

/**
 * Celtic Knot pattern — interlacing knotwork using a grid-based approach.
 * At each grid intersection, crossing patterns (over/under) are chosen.
 * Smooth curves connect grid edges with proper over-under rendering.
 */
export const celticKnot: PatternGenerator = {
  name: 'celtic-knot',
  displayName: 'Celtic Knot',
  description: 'Interlacing knotwork with over-under crossings on a grid',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Grid parameters
    const baseSize = Math.max(width, height) / 10;
    const cellSize = baseSize / zoom;
    const halfCell = cellSize / 2;
    const strandWidth = cellSize * 0.15;
    const gapWidth = strandWidth + 4; // gap for under-crossings

    // Pick 2-3 knot colors
    const shuffled = [...fgColors];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const knotColors = shuffled.slice(0, 2 + Math.floor(rand() * 2));

    const cols = Math.ceil(width / cellSize) + 2;
    const rows = Math.ceil(height / cellSize) + 2;

    // Generate crossing grid: true = horizontal over, false = vertical over
    const crossings: boolean[][] = [];
    for (let row = 0; row <= rows; row++) {
      crossings[row] = [];
      for (let col = 0; col <= cols; col++) {
        crossings[row][col] = rand() > 0.5;
      }
    }

    // Collect all curve segments with their crossing info
    interface CurveSegment {
      type: 'h' | 'v'; // horizontal or vertical dominant
      x1: number;
      y1: number;
      cx1: number;
      cy1: number;
      cx2: number;
      cy2: number;
      x2: number;
      y2: number;
      color: string;
      isOver: boolean;
    }
    const segments: CurveSegment[] = [];

    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const x = col * cellSize;
        const y = row * cellSize;
        const cx = x + halfCell;
        const cy = y + halfCell;

        const safeRow = ((row % rows) + rows) % rows;
        const safeCol = ((col % cols) + cols) % cols;
        const isHOver = crossings[safeRow]?.[safeCol] ?? true;

        const colorIdx = (Math.abs(row) + Math.abs(col)) % knotColors.length;
        const color = knotColors[colorIdx];

        // Horizontal curve through this cell
        segments.push({
          type: 'h',
          x1: x, y1: cy,
          cx1: x + halfCell * 0.5, cy1: cy - halfCell * 0.3,
          cx2: x + halfCell * 1.5, cy2: cy + halfCell * 0.3,
          x2: x + cellSize, y2: cy,
          color,
          isOver: isHOver,
        });

        // Vertical curve through this cell
        const colorIdx2 = (Math.abs(row) + Math.abs(col) + 1) % knotColors.length;
        segments.push({
          type: 'v',
          x1: cx, y1: y,
          cx1: cx - halfCell * 0.3, cy1: y + halfCell * 0.5,
          cx2: cx + halfCell * 0.3, cy2: y + halfCell * 1.5,
          x2: cx, y2: y + cellSize,
          color: knotColors[colorIdx2],
          isOver: !isHOver,
        });
      }
    }

    // Draw under strands first, then over strands
    const underStrands = segments.filter((s) => !s.isOver);
    const overStrands = segments.filter((s) => s.isOver);

    function drawStrand(s: CurveSegment, isGap: boolean): void {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.bezierCurveTo(s.cx1, s.cy1, s.cx2, s.cy2, s.x2, s.y2);
      if (isGap) {
        ctx.strokeStyle = bg;
        ctx.lineWidth = gapWidth;
      } else {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = strandWidth;
      }
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    function drawStrandHighlight(s: CurveSegment): void {
      // Edge highlight
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.bezierCurveTo(s.cx1, s.cy1, s.cx2, s.cy2, s.x2, s.y2);
      ctx.strokeStyle = withAlpha(lighten(s.color, 0.4), 0.3);
      ctx.lineWidth = strandWidth * 0.3;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Dark border
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.bezierCurveTo(s.cx1, s.cy1, s.cx2, s.cy2, s.x2, s.y2);
      ctx.strokeStyle = withAlpha(darken(s.color, 0.5), 0.2);
      ctx.lineWidth = strandWidth + 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Under strands: draw border, then strand
    for (const s of underStrands) {
      drawStrandHighlight(s);
      drawStrand(s, false);
    }

    // Over strands: draw gap (bg) over the under strands, then the strand itself
    for (const s of overStrands) {
      drawStrand(s, true); // gap
      drawStrandHighlight(s);
      drawStrand(s, false); // colored strand
    }

    // Add small knot circles at intersections for decoration
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const x = col * cellSize;
        const y = row * cellSize;
        const colorIdx = (row + col) % knotColors.length;
        ctx.fillStyle = withAlpha(knotColors[colorIdx], 0.3);
        ctx.beginPath();
        ctx.arc(x, y, strandWidth * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};
