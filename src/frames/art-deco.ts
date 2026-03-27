import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#c9a84c',
  },
  {
    key: 'ornamentSize',
    label: 'Ornament Size',
    type: 'slider',
    min: 20,
    max: 80,
    step: 1,
    defaultValue: 50,
  },
  {
    key: 'lineWidth',
    label: 'Line Width',
    type: 'slider',
    min: 1,
    max: 6,
    step: 0.5,
    defaultValue: 2,
  },
  {
    key: 'ornamentStyle',
    label: 'Ornament Style',
    type: 'select',
    options: [
      { value: 0, label: 'Fan' },
      { value: 1, label: 'Chevron' },
      { value: 2, label: 'Stepped' },
    ],
    defaultValue: 0,
  },
  {
    key: 'connectCorners',
    label: 'Connect Corners',
    type: 'toggle',
    defaultValue: 1,
  },
];

export const artDeco: FrameGenerator = {
  name: 'art-deco',
  displayName: 'Art Deco Geometric Frame',
  description: '1920s-1930s inspired frame with geometric corner ornaments',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const color = (params.color as string) ?? '#c9a84c';
    const ornamentSize = (params.ornamentSize as number) ?? 50;
    const lineWidth = (params.lineWidth as number) ?? 2;
    const ornamentStyle = (params.ornamentStyle as number) ?? 0;
    const connectCorners = (params.connectCorners as number) ?? 1;

    ctx.save();

    const rgba = hexToRgba(color);
    ctx.strokeStyle = rgba;
    ctx.fillStyle = rgba;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    const margin = lineWidth;

    // Connect corners with border lines
    if (connectCorners === 1) {
      ctx.beginPath();
      // Top line
      ctx.moveTo(ornamentSize + margin, margin);
      ctx.lineTo(width - ornamentSize - margin, margin);
      // Bottom line
      ctx.moveTo(ornamentSize + margin, height - margin);
      ctx.lineTo(width - ornamentSize - margin, height - margin);
      // Left line
      ctx.moveTo(margin, ornamentSize + margin);
      ctx.lineTo(margin, height - ornamentSize - margin);
      // Right line
      ctx.moveTo(width - margin, ornamentSize + margin);
      ctx.lineTo(width - margin, height - ornamentSize - margin);
      ctx.stroke();
    }

    // Draw ornaments in all 4 corners
    const corners: Array<{ x: number; y: number; flipX: number; flipY: number }> = [
      { x: margin, y: margin, flipX: 1, flipY: 1 },
      { x: width - margin, y: margin, flipX: -1, flipY: 1 },
      { x: width - margin, y: height - margin, flipX: -1, flipY: -1 },
      { x: margin, y: height - margin, flipX: 1, flipY: -1 },
    ];

    for (const corner of corners) {
      ctx.save();
      ctx.translate(corner.x, corner.y);
      ctx.scale(corner.flipX, corner.flipY);

      if (ornamentStyle === 0) {
        drawFan(ctx, ornamentSize, lineWidth);
      } else if (ornamentStyle === 1) {
        drawChevron(ctx, ornamentSize, lineWidth);
      } else {
        drawStepped(ctx, ornamentSize, lineWidth);
      }

      ctx.restore();
    }

    ctx.restore();
  },
};

function drawFan(ctx: CanvasRenderingContext2D, size: number, lw: number): void {
  const arcCount = 5;
  ctx.lineWidth = lw;

  // Corner L-shape
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.stroke();

  // Fan arcs radiating from the corner
  for (let i = 1; i <= arcCount; i++) {
    const r = (size * i) / (arcCount + 1);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI / 2);
    ctx.stroke();
  }
}

function drawChevron(ctx: CanvasRenderingContext2D, size: number, lw: number): void {
  const count = 4;
  ctx.lineWidth = lw;

  // Corner L-shape
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.stroke();

  // Stacked V-shapes pointing into the corner
  for (let i = 1; i <= count; i++) {
    const offset = (size * i) / (count + 1);
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(offset, offset);
    ctx.lineTo(offset, 0);
    ctx.stroke();
  }
}

function drawStepped(ctx: CanvasRenderingContext2D, size: number, lw: number): void {
  const steps = 5;
  ctx.lineWidth = lw;

  // Corner L-shape
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.stroke();

  // Stepped pyramid: staircase from (0, size) to (size, 0)
  ctx.beginPath();
  const stepW = size / steps;
  const stepH = size / steps;
  ctx.moveTo(0, size);
  for (let i = 0; i < steps; i++) {
    const x = stepW * i;
    const y = size - stepH * (i + 1);
    ctx.lineTo(x, y);
    ctx.lineTo(x + stepW, y);
  }
  ctx.stroke();
}
