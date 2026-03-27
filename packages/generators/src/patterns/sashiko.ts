import type { ParamDef, PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';
import { getParam } from '@takazudo/pattern-gen-core';
import { darken, lighten, withAlpha } from '@takazudo/pattern-gen-core';
import { shuffleArray } from '@takazudo/pattern-gen-core';
import { randomizeDefaults } from '@takazudo/pattern-gen-core';

const paramDefs: ParamDef[] = [
  {
    key: 'motif',
    label: 'Motif',
    type: 'select',
    options: [
      { value: 0, label: 'Asa-no-ha' },
      { value: 1, label: 'Nowaki' },
      { value: 2, label: 'Uroko' },
      { value: 3, label: 'Yabane' },
    ],
    defaultValue: 0,
  },
  {
    key: 'cellSize',
    label: 'Cell Size',
    type: 'slider',
    min: 4,
    max: 30,
    step: 1,
    defaultValue: 12,
  },
  {
    key: 'stitchDash',
    label: 'Stitch Dash',
    type: 'slider',
    min: 0.05,
    max: 0.3,
    step: 0.01,
    defaultValue: 0.15,
  },
  {
    key: 'threadColors',
    label: 'Thread Colors',
    type: 'select',
    options: [
      { value: 1, label: '1 Thread' },
      { value: 2, label: '2 Threads' },
      { value: 3, label: '3 Threads' },
    ],
    defaultValue: 1,
  },
  {
    key: 'gapIrregularity',
    label: 'Gap Irregularity',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0,
  },
  {
    key: 'threadThickness',
    label: 'Thread Thickness',
    type: 'slider',
    min: 0.5,
    max: 3.0,
    step: 0.25,
    defaultValue: 1.0,
  },
  {
    key: 'motifRotation',
    label: 'Motif Rotation',
    type: 'select',
    options: [
      { value: 0, label: '0°' },
      { value: 1, label: '90°' },
      { value: 2, label: '180°' },
      { value: 3, label: '270°' },
    ],
    defaultValue: 0,
  },
];

/** Creates a stitch function that handles color cycling and gap irregularity */
function createStitcher(
  ctx: CanvasRenderingContext2D,
  colors: string[],
  dashLen: number,
  baseGap: number,
  gapIrregularity: number,
  rand: () => number,
): () => void {
  let idx = 0;
  return () => {
    ctx.strokeStyle = colors[idx % colors.length];
    idx++;
    if (gapIrregularity > 0) {
      const variation = 1 + (rand() * 2 - 1) * gapIrregularity;
      ctx.setLineDash([dashLen, baseGap * Math.max(0.2, variation)]);
    }
    ctx.stroke();
  };
}

/**
 * Sashiko pattern — Japanese stitching patterns rendered as dashed lines.
 * Randomly selects one of four motifs: asa-no-ha (hemp leaf), nowaki (waves),
 * uroko (scales), or yabane (arrow feathers).
 */
export const sashiko: PatternGenerator = {
  name: 'sashiko',
  displayName: 'Sashiko',
  description: 'Japanese sashiko stitching with dashed stitch lines on fabric background',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

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

    // Thread colors — pick 1-3 distinct colors from fg palette
    const numColors = getParam(options, paramDefs, 'threadColors');
    const shuffledColors = shuffleArray(fgColors, rand);
    const stitchColors = shuffledColors.slice(0, numColors);

    // Stitch parameters
    const cellSizeDivisor = getParam(options, paramDefs, 'cellSize');
    const baseSize = Math.max(width, height) / cellSizeDivisor;
    const cellSize = baseSize / zoom;
    const thicknessMul = getParam(options, paramDefs, 'threadThickness');
    const stitchWidth = Math.max(1.5, cellSize * 0.04) * thicknessMul;
    const stitchDashFactor = getParam(options, paramDefs, 'stitchDash');
    const dashLen = cellSize * stitchDashFactor;
    const gapLen = cellSize * 0.08;
    const gapIrregularity = getParam(options, paramDefs, 'gapIrregularity');

    ctx.lineWidth = stitchWidth;
    ctx.lineCap = 'round';
    ctx.setLineDash([dashLen, gapLen]);

    // Create stitch function for color cycling and gap irregularity
    const stitch = createStitcher(ctx, stitchColors, dashLen, gapLen, gapIrregularity, rand);

    // Choose motif
    const motifs = ['asa-no-ha', 'nowaki', 'uroko', 'yabane'] as const;
    const motifIndex = getParam(options, paramDefs, 'motif');
    const motif = motifs[motifIndex];

    // Apply motif rotation (0/90/180/270 degrees)
    const rotation = getParam(options, paramDefs, 'motifRotation');
    if (rotation > 0) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-width / 2, -height / 2);
    }

    // Extra cells for 90/270 rotation to ensure full canvas coverage.
    // Nowaki rows are spaced at arcRadius (cellSize/2), so needs 2x extra cells.
    const extra = (() => {
      if (rotation !== 1 && rotation !== 3) return 0;
      const rowSpacing = motif === 'nowaki' ? cellSize / 2 : cellSize;
      return Math.ceil(Math.abs(width - height) / 2 / rowSpacing) + 2;
    })();

    const cols = Math.ceil(width / cellSize) + 2;
    const rows = Math.ceil(height / cellSize) + 2;

    switch (motif) {
      case 'asa-no-ha':
        drawAsaNoHa(ctx, cellSize, cols, rows, extra, stitch);
        break;
      case 'nowaki':
        drawNowaki(ctx, cellSize, cols, rows, extra, stitch);
        break;
      case 'uroko':
        drawUroko(ctx, cellSize, cols, rows, extra, stitch);
        break;
      case 'yabane':
        drawYabane(ctx, cellSize, cols, rows, extra, stitch);
        break;
    }

    if (rotation > 0) {
      ctx.restore();
    }

    // Reset line dash
    ctx.setLineDash([]);
  },
};

/** Asa-no-ha (hemp leaf) — six-pointed star formed by triangular divisions */
function drawAsaNoHa(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  cols: number,
  rows: number,
  extra: number,
  stitch: () => void,
): void {
  const half = cellSize / 2;

  for (let row = -1 - extra; row <= rows + extra; row++) {
    for (let col = -1 - extra; col <= cols + extra; col++) {
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
        stitch();
      }

      // Diamond outline around cell
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(x + cellSize, cy);
      ctx.lineTo(cx, y + cellSize);
      ctx.lineTo(x, cy);
      ctx.closePath();
      stitch();
    }
  }
}

/** Nowaki (waves) — concentric arcs in alternating rows */
function drawNowaki(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  cols: number,
  rows: number,
  extra: number,
  stitch: () => void,
): void {
  const arcRadius = cellSize / 2;

  for (let row = -1 - extra; row <= rows * 2 + extra; row++) {
    const yOff = row % 2 === 0 ? 0 : cellSize / 2;

    for (let col = -1 - extra; col <= cols + 1 + extra; col++) {
      const cx = col * cellSize + yOff;
      const cy = row * arcRadius;

      // Draw 3 nested arcs
      for (let r = 1; r <= 3; r++) {
        const arcR = arcRadius * (r / 3);
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, 0, Math.PI);
        stitch();
      }
    }
  }
}

/** Uroko (scales) — overlapping triangular scales */
function drawUroko(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  cols: number,
  rows: number,
  extra: number,
  stitch: () => void,
): void {
  const triH = cellSize * 0.866; // height of equilateral triangle

  for (let row = -1 - extra; row <= rows + 1 + extra; row++) {
    const xOff = row % 2 === 0 ? 0 : cellSize / 2;

    for (let col = -1 - extra; col <= cols + 1 + extra; col++) {
      const x = col * cellSize + xOff;
      const y = row * triH * 0.5;

      // Upward triangle
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cellSize / 2, y - triH * 0.5);
      ctx.lineTo(x + cellSize, y);
      ctx.closePath();
      stitch();

      // Downward triangle
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cellSize / 2, y + triH * 0.5);
      ctx.lineTo(x + cellSize, y);
      ctx.closePath();
      stitch();
    }
  }
}

/** Yabane (arrow feathers) — chevron/arrow patterns in rows */
function drawYabane(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  cols: number,
  rows: number,
  extra: number,
  stitch: () => void,
): void {
  const arrowW = cellSize;
  const arrowH = cellSize * 0.6;

  for (let row = -1 - extra; row <= rows + 1 + extra; row++) {
    const xOff = row % 2 === 0 ? 0 : arrowW / 2;

    for (let col = -1 - extra; col <= cols + 1 + extra; col++) {
      const x = col * arrowW + xOff;
      const y = row * arrowH;

      // Left half of arrow
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + arrowW / 2, y + arrowH / 2);
      ctx.lineTo(x, y + arrowH);
      stitch();

      // Right half of arrow
      ctx.beginPath();
      ctx.moveTo(x + arrowW, y);
      ctx.lineTo(x + arrowW / 2, y + arrowH / 2);
      ctx.lineTo(x + arrowW, y + arrowH);
      stitch();

      // Horizontal lines within arrow
      const numLines = 3;
      for (let l = 0; l <= numLines; l++) {
        const ly = y + (arrowH * l) / numLines;
        const progress = l / numLines;
        const indent = (arrowW / 2) * Math.abs(progress - 0.5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + indent, ly);
        ctx.lineTo(x + arrowW - indent, ly);
        stitch();
      }
    }
  }
}
