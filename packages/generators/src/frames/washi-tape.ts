import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
import { hexToRgba, hexAlpha } from './frame-utils.js';
import { getFrameParam } from './get-frame-param.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'tapeWidth',
    label: 'Tape Width',
    type: 'slider',
    min: 15,
    max: 50,
    step: 1,
    defaultValue: 30,
  },
  {
    key: 'tapeColor',
    label: 'Tape Color',
    type: 'color',
    defaultValue: '#e8b4b8cc',
  },
  {
    key: 'pattern',
    label: 'Pattern',
    type: 'select',
    options: [
      { value: 0, label: 'Diagonal Stripes' },
      { value: 1, label: 'Dots' },
      { value: 2, label: 'Solid' },
      { value: 3, label: 'Crosshatch' },
    ],
    defaultValue: 0,
  },
  {
    key: 'patternScale',
    label: 'Pattern Scale',
    type: 'slider',
    min: 3,
    max: 15,
    step: 1,
    defaultValue: 8,
  },
  {
    key: 'sides',
    label: 'Sides',
    type: 'select',
    options: [
      { value: 0, label: 'Top & Bottom' },
      { value: 1, label: 'Left & Right' },
      { value: 2, label: 'All Four' },
    ],
    defaultValue: 2,
  },
];

function drawTapePattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pattern: number,
  scale: number,
  patternColor: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.strokeStyle = patternColor;
  ctx.fillStyle = patternColor;
  ctx.lineWidth = 1;

  if (pattern === 0) {
    // Diagonal stripes
    const spacing = scale * 2;
    const maxDim = Math.max(w, h) * 2;
    for (let i = -maxDim; i < maxDim; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + maxDim, y + maxDim);
      ctx.stroke();
    }
  } else if (pattern === 1) {
    // Dots
    const spacing = scale * 2;
    const dotR = scale * 0.3;
    for (let dx = x + spacing / 2; dx < x + w; dx += spacing) {
      for (let dy = y + spacing / 2; dy < y + h; dy += spacing) {
        ctx.beginPath();
        ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 3) {
    // Crosshatch
    const spacing = scale * 2;
    const maxDim = Math.max(w, h) * 2;
    for (let i = -maxDim; i < maxDim; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + maxDim, y + maxDim);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + i + maxDim, y);
      ctx.lineTo(x + i, y + maxDim);
      ctx.stroke();
    }
  }
  // pattern === 2 (solid) — no extra drawing needed

  ctx.restore();
}

export const washiTape: FrameGenerator = {
  name: 'washi-tape',
  displayName: 'Washi Tape Strips',
  description: 'Decorative tape strips along edges, semi-transparent with patterns',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const tapeWidth = getFrameParam(params, 'tapeWidth', 30);
    const tapeColor = getFrameParam(params, 'tapeColor', '#e8b4b8cc');
    const pattern = getFrameParam(params, 'pattern', 0);
    const patternScale = getFrameParam(params, 'patternScale', 8);
    const sides = getFrameParam(params, 'sides', 2);

    // Parse alpha; use for globalAlpha. Extract opaque base via hexToRgba with validation.
    const alpha = hexAlpha(tapeColor);
    // Strip alpha from color — build opaque version for fillStyle (alpha via globalAlpha)
    const opaqueHex = tapeColor.slice(0, 7);
    const baseRgba = hexToRgba(opaqueHex);
    const patternColor = 'rgba(0, 0, 0, 0.15)';

    ctx.save();
    ctx.globalAlpha = alpha;

    const drawTape = (x: number, y: number, w: number, h: number) => {
      // Base tape color
      ctx.fillStyle = baseRgba;
      ctx.fillRect(x, y, w, h);
      // Tape pattern overlay
      drawTapePattern(ctx, x, y, w, h, pattern, patternScale, patternColor);
      // Subtle edge highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, w, h);
    };

    const drawTop = sides === 0 || sides === 2;
    const drawBottom = sides === 0 || sides === 2;
    const drawLeft = sides === 1 || sides === 2;
    const drawRight = sides === 1 || sides === 2;

    if (drawTop) drawTape(0, 0, width, tapeWidth);
    if (drawBottom) drawTape(0, height - tapeWidth, width, tapeWidth);
    // Clip left/right strips to exclude corners if top/bottom are also drawn
    const lrTop = drawTop ? tapeWidth : 0;
    const lrHeight = height - lrTop - (drawBottom ? tapeWidth : 0);
    if (drawLeft && lrHeight > 0) drawTape(0, lrTop, tapeWidth, lrHeight);
    if (drawRight && lrHeight > 0) drawTape(width - tapeWidth, lrTop, tapeWidth, lrHeight);

    ctx.restore();
  },
};
