import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
import { hexToRgba } from './frame-utils.js';
import { getFrameParam } from './get-frame-param.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 4,
    max: 50,
    step: 1,
    defaultValue: 12,
  },
  {
    key: 'colorStart',
    label: 'Start Color',
    type: 'color',
    defaultValue: '#3b82f6',
  },
  {
    key: 'colorEnd',
    label: 'End Color',
    type: 'color',
    defaultValue: '#ec4899',
  },
  {
    key: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { value: 0, label: 'Clockwise' },
      { value: 1, label: 'Horizontal' },
      { value: 2, label: 'Vertical' },
      { value: 3, label: 'Diagonal' },
    ],
    defaultValue: 0,
  },
];

export const gradientBorder: FrameGenerator = {
  name: 'gradient-border',
  displayName: 'Gradient Border',
  description: 'Border that transitions between colors along each side',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const bw = getFrameParam(params, 'borderWidth', 12);
    const colorStart = getFrameParam(params, 'colorStart', '#3b82f6');
    const colorEnd = getFrameParam(params, 'colorEnd', '#ec4899');
    const direction = getFrameParam(params, 'direction', 0);

    ctx.save();

    const startRgba = hexToRgba(colorStart);
    const endRgba = hexToRgba(colorEnd);

    if (direction === 0) {
      // Clockwise sweep: start at top-left, transition through end at bottom, back to start
      // Top side: start -> end (left to right)
      const topGrad = ctx.createLinearGradient(0, 0, width, 0);
      topGrad.addColorStop(0, startRgba);
      topGrad.addColorStop(1, endRgba);
      ctx.fillStyle = topGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width - bw, bw);
      ctx.lineTo(bw, bw);
      ctx.closePath();
      ctx.fill();

      // Right side: end -> end (continues end color down)
      const rightGrad = ctx.createLinearGradient(0, 0, 0, height);
      rightGrad.addColorStop(0, endRgba);
      rightGrad.addColorStop(1, endRgba);
      ctx.fillStyle = rightGrad;
      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(width - bw, height - bw);
      ctx.lineTo(width - bw, bw);
      ctx.closePath();
      ctx.fill();

      // Bottom side: end -> start (right to left = end to start)
      const bottomGrad = ctx.createLinearGradient(width, 0, 0, 0);
      bottomGrad.addColorStop(0, endRgba);
      bottomGrad.addColorStop(1, startRgba);
      ctx.fillStyle = bottomGrad;
      ctx.beginPath();
      ctx.moveTo(width, height);
      ctx.lineTo(0, height);
      ctx.lineTo(bw, height - bw);
      ctx.lineTo(width - bw, height - bw);
      ctx.closePath();
      ctx.fill();

      // Left side: start -> start (continues start color up)
      const leftGrad = ctx.createLinearGradient(0, height, 0, 0);
      leftGrad.addColorStop(0, startRgba);
      leftGrad.addColorStop(1, startRgba);
      ctx.fillStyle = leftGrad;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, 0);
      ctx.lineTo(bw, bw);
      ctx.lineTo(bw, height - bw);
      ctx.closePath();
      ctx.fill();
    } else if (direction === 1) {
      // Horizontal gradient across the whole border
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, startRgba);
      grad.addColorStop(1, endRgba);
      ctx.fillStyle = grad;
      drawBorderPath(ctx, width, height, bw);
      ctx.fill('evenodd');
    } else if (direction === 2) {
      // Vertical gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, startRgba);
      grad.addColorStop(1, endRgba);
      ctx.fillStyle = grad;
      drawBorderPath(ctx, width, height, bw);
      ctx.fill('evenodd');
    } else {
      // Diagonal gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, startRgba);
      grad.addColorStop(1, endRgba);
      ctx.fillStyle = grad;
      drawBorderPath(ctx, width, height, bw);
      ctx.fill('evenodd');
    }

    ctx.restore();
  },
};

function drawBorderPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bw: number,
): void {
  ctx.beginPath();
  // Outer rectangle (clockwise)
  ctx.rect(0, 0, width, height);
  // Inner rectangle (counter-clockwise via second rect for evenodd)
  ctx.rect(bw, bw, width - 2 * bw, height - 2 * bw);
}
