import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { darken, lighten, withAlpha } from '../core/color-utils.js';

/**
 * Sashiko pattern — Japanese stitching patterns rendered as dashed lines.
 * Randomly selects one of four motifs: asa-no-ha (hemp leaf), nowaki (waves),
 * uroko (scales), or yabane (arrow feathers).
 */
export const sashiko: PatternGenerator = {
  name: 'sashiko',
  displayName: 'Sashiko',
  description: 'Japanese sashiko stitching with dashed stitch lines on fabric background',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fabric background — slightly textured feel
    const fabricColor = lighten(bg, 0.05);
    ctx.fillStyle = fabricColor;
    ctx.fillRect(0, 0, width, height);

    // Add subtle fabric texture
    const textureColor = withAlpha(darken(fabricColor, 0.9), 0.15);
    for (let i = 0; i < width * height * 0.002; i++) {
      const fx = rand() * width;
      const fy = rand() * height;
      ctx.fillStyle = textureColor;
      ctx.fillRect(fx, fy, 1, 1);
    }

    // Stitch color — pick one fg color
    const stitchColor = fgColors[Math.floor(rand() * fgColors.length)];

    // Stitch parameters
    const baseSize = Math.max(width, height) / 12;
    const cellSize = baseSize / zoom;
    const stitchWidth = Math.max(1.5, cellSize * 0.04);
    const dashLen = cellSize * 0.15;
    const gapLen = cellSize * 0.08;

    ctx.strokeStyle = stitchColor;
    ctx.lineWidth = stitchWidth;
    ctx.lineCap = 'round';
    ctx.setLineDash([dashLen, gapLen]);

    // Choose motif
    const motifs = ['asa-no-ha', 'nowaki', 'uroko', 'yabane'] as const;
    const motif = motifs[Math.floor(rand() * motifs.length)];

    const cols = Math.ceil(width / cellSize) + 2;
    const rows = Math.ceil(height / cellSize) + 2;

    switch (motif) {
      case 'asa-no-ha':
        drawAsaNoHa(ctx, width, height, cellSize, cols, rows);
        break;
      case 'nowaki':
        drawNowaki(ctx, width, height, cellSize, cols, rows);
        break;
      case 'uroko':
        drawUroko(ctx, width, height, cellSize, cols, rows);
        break;
      case 'yabane':
        drawYabane(ctx, width, height, cellSize, cols, rows);
        break;
    }

    // Reset line dash
    ctx.setLineDash([]);
  },
};

/** Asa-no-ha (hemp leaf) — six-pointed star formed by triangular divisions */
function drawAsaNoHa(
  ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  cellSize: number,
  cols: number,
  rows: number,
): void {
  const half = cellSize / 2;

  for (let row = -1; row <= rows; row++) {
    for (let col = -1; col <= cols; col++) {
      const x = col * cellSize;
      const y = row * cellSize;

      // Center of the cell
      const cx = x + half;
      const cy = y + half;

      // Draw 6 lines from center to edges/corners forming the hemp leaf star
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const ex = cx + Math.cos(angle) * half;
        const ey = cy + Math.sin(angle) * half;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Diamond outline around cell
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(x + cellSize, cy);
      ctx.lineTo(cx, y + cellSize);
      ctx.lineTo(x, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

/** Nowaki (waves) — concentric arcs in alternating rows */
function drawNowaki(
  ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  cellSize: number,
  cols: number,
  rows: number,
): void {
  const arcRadius = cellSize / 2;

  for (let row = -1; row <= rows * 2; row++) {
    const yOff = row % 2 === 0 ? 0 : cellSize / 2;

    for (let col = -1; col <= cols + 1; col++) {
      const cx = col * cellSize + yOff;
      const cy = row * arcRadius;

      // Draw 3 nested arcs
      for (let r = 1; r <= 3; r++) {
        const arcR = arcRadius * (r / 3);
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, 0, Math.PI);
        ctx.stroke();
      }
    }
  }
}

/** Uroko (scales) — overlapping triangular scales */
function drawUroko(
  ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  cellSize: number,
  cols: number,
  rows: number,
): void {
  const triH = cellSize * 0.866; // height of equilateral triangle

  for (let row = -1; row <= rows + 1; row++) {
    const xOff = row % 2 === 0 ? 0 : cellSize / 2;

    for (let col = -1; col <= cols + 1; col++) {
      const x = col * cellSize + xOff;
      const y = row * triH * 0.5;

      // Upward triangle
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cellSize / 2, y - triH * 0.5);
      ctx.lineTo(x + cellSize, y);
      ctx.closePath();
      ctx.stroke();

      // Downward triangle
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cellSize / 2, y + triH * 0.5);
      ctx.lineTo(x + cellSize, y);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

/** Yabane (arrow feathers) — chevron/arrow patterns in rows */
function drawYabane(
  ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  cellSize: number,
  cols: number,
  rows: number,
): void {
  const arrowW = cellSize;
  const arrowH = cellSize * 0.6;

  for (let row = -1; row <= rows + 1; row++) {
    const xOff = row % 2 === 0 ? 0 : arrowW / 2;

    for (let col = -1; col <= cols + 1; col++) {
      const x = col * arrowW + xOff;
      const y = row * arrowH;

      // Left half of arrow
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + arrowW / 2, y + arrowH / 2);
      ctx.lineTo(x, y + arrowH);
      ctx.stroke();

      // Right half of arrow
      ctx.beginPath();
      ctx.moveTo(x + arrowW, y);
      ctx.lineTo(x + arrowW / 2, y + arrowH / 2);
      ctx.lineTo(x + arrowW, y + arrowH);
      ctx.stroke();

      // Horizontal lines within arrow
      const numLines = 3;
      for (let l = 0; l <= numLines; l++) {
        const ly = y + (arrowH * l) / numLines;
        const progress = l / numLines;
        const indent = (arrowW / 2) * Math.abs(progress - 0.5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + indent, ly);
        ctx.lineTo(x + arrowW - indent, ly);
        ctx.stroke();
      }
    }
  }
}
