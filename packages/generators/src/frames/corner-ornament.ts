import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
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
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#333333',
  },
  {
    key: 'lineWidth',
    label: 'Line Width',
    type: 'slider',
    min: 0.5,
    max: 4,
    step: 0.5,
    defaultValue: 1.5,
  },
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    options: [
      { value: 0, label: 'Scroll' },
      { value: 1, label: 'Bracket' },
      { value: 2, label: 'Floral' },
    ],
    defaultValue: 0,
  },
  {
    key: 'connectLines',
    label: 'Connect Lines',
    type: 'toggle',
    defaultValue: 1,
  },
];

function drawScrollOrnament(ctx: CanvasRenderingContext2D, size: number): void {
  // Scroll/flourish ornament in top-left corner (relative to origin)
  ctx.beginPath();
  // Outer scroll curve
  ctx.moveTo(0, size);
  ctx.quadraticCurveTo(0, 0, size, 0);
  ctx.stroke();

  // Inner scroll spiral
  ctx.beginPath();
  ctx.moveTo(size * 0.15, size * 0.7);
  ctx.bezierCurveTo(size * 0.05, size * 0.3, size * 0.3, size * 0.05, size * 0.7, size * 0.15);
  ctx.stroke();

  // Small spiral curl
  ctx.beginPath();
  ctx.moveTo(size * 0.25, size * 0.5);
  ctx.bezierCurveTo(size * 0.15, size * 0.25, size * 0.25, size * 0.15, size * 0.5, size * 0.25);
  ctx.stroke();
}

function drawBracketOrnament(ctx: CanvasRenderingContext2D, size: number): void {
  // L-bracket with decorative ends
  ctx.beginPath();
  ctx.moveTo(size * 0.3, 0);
  ctx.lineTo(0, 0);
  ctx.lineTo(0, size * 0.3);
  ctx.stroke();

  // Decorative end caps
  ctx.beginPath();
  ctx.arc(size * 0.3, 0, size * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, size * 0.3, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Inner detail
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.06);
  ctx.lineTo(size * 0.06, size * 0.06);
  ctx.lineTo(size * 0.06, size * 0.2);
  ctx.stroke();
}

function drawFloralOrnament(ctx: CanvasRenderingContext2D, size: number): void {
  // Floral corner with leaf/petal curves
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.bezierCurveTo(0, size * 0.4, size * 0.4, 0, size, 0);
  ctx.stroke();

  // Leaf shape 1
  ctx.beginPath();
  ctx.moveTo(size * 0.15, size * 0.55);
  ctx.bezierCurveTo(size * 0.0, size * 0.35, size * 0.15, size * 0.2, size * 0.35, size * 0.3);
  ctx.bezierCurveTo(size * 0.2, size * 0.45, size * 0.25, size * 0.55, size * 0.15, size * 0.55);
  ctx.fill();

  // Leaf shape 2
  ctx.beginPath();
  ctx.moveTo(size * 0.55, size * 0.15);
  ctx.bezierCurveTo(size * 0.35, size * 0.0, size * 0.2, size * 0.15, size * 0.3, size * 0.35);
  ctx.bezierCurveTo(size * 0.45, size * 0.2, size * 0.55, size * 0.25, size * 0.55, size * 0.15);
  ctx.fill();

  // Center dot
  ctx.beginPath();
  ctx.arc(size * 0.2, size * 0.2, size * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

export const cornerOrnament: FrameGenerator = {
  name: 'corner-ornament',
  displayName: 'Corner Ornament',
  description: 'Ornamental flourishes in corners connected by thin lines',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const ornamentSize = (params.ornamentSize as number) ?? 50;
    const color = (params.color as string) ?? '#333333';
    const lineWidth = (params.lineWidth as number) ?? 1.5;
    const style = (params.style as number) ?? 0;
    const connectLines = (params.connectLines as number) ?? 1;

    const rgba = hexToRgba(color);
    const margin = ornamentSize * 0.3;

    ctx.save();
    ctx.strokeStyle = rgba;
    ctx.fillStyle = rgba;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawOrnament = style === 0 ? drawScrollOrnament : style === 1 ? drawBracketOrnament : drawFloralOrnament;

    // Top-left corner
    ctx.save();
    ctx.translate(margin, margin);
    drawOrnament(ctx, ornamentSize);
    ctx.restore();

    // Top-right corner (mirror horizontally)
    ctx.save();
    ctx.translate(width - margin, margin);
    ctx.scale(-1, 1);
    drawOrnament(ctx, ornamentSize);
    ctx.restore();

    // Bottom-left corner (mirror vertically)
    ctx.save();
    ctx.translate(margin, height - margin);
    ctx.scale(1, -1);
    drawOrnament(ctx, ornamentSize);
    ctx.restore();

    // Bottom-right corner (mirror both)
    ctx.save();
    ctx.translate(width - margin, height - margin);
    ctx.scale(-1, -1);
    drawOrnament(ctx, ornamentSize);
    ctx.restore();

    // Connecting lines between corners
    if (connectLines) {
      ctx.lineWidth = lineWidth * 0.5;
      ctx.globalAlpha = 0.6;
      const inset = margin + ornamentSize;

      // Top line
      ctx.beginPath();
      ctx.moveTo(inset, margin);
      ctx.lineTo(width - inset, margin);
      ctx.stroke();

      // Bottom line
      ctx.beginPath();
      ctx.moveTo(inset, height - margin);
      ctx.lineTo(width - inset, height - margin);
      ctx.stroke();

      // Left line
      ctx.beginPath();
      ctx.moveTo(margin, inset);
      ctx.lineTo(margin, height - inset);
      ctx.stroke();

      // Right line
      ctx.beginPath();
      ctx.moveTo(width - margin, inset);
      ctx.lineTo(width - margin, height - inset);
      ctx.stroke();
    }

    ctx.restore();
  },
};
