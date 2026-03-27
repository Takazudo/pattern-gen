import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'amplitude',
    label: 'Amplitude',
    type: 'slider',
    min: 5,
    max: 30,
    step: 1,
    defaultValue: 12,
  },
  {
    key: 'frequency',
    label: 'Frequency',
    type: 'slider',
    min: 5,
    max: 25,
    step: 1,
    defaultValue: 12,
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
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#333333',
  },
  {
    key: 'rows',
    label: 'Rows',
    type: 'select',
    options: [
      { value: 1, label: 'Single' },
      { value: 2, label: 'Double' },
      { value: 3, label: 'Triple' },
    ],
    defaultValue: 1,
  },
  {
    key: 'filled',
    label: 'Filled',
    type: 'toggle',
    defaultValue: 0,
  },
];

function drawZigzagLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  amplitude: number,
  numZigs: number,
  filled: boolean,
): void {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const perpAngle = angle + Math.PI / 2;

  if (filled) {
    // Draw filled triangles
    for (let i = 0; i < numZigs; i++) {
      const t0 = i / numZigs;
      const t1 = (i + 1) / numZigs;
      const tMid = (t0 + t1) / 2;

      const x0 = startX + dx * t0;
      const y0 = startY + dy * t0;
      const x1 = startX + dx * t1;
      const y1 = startY + dy * t1;
      const sign = i % 2 === 0 ? 1 : -1;
      const peakX = startX + dx * tMid + Math.cos(perpAngle) * amplitude * sign;
      const peakY = startY + dy * tMid + Math.sin(perpAngle) * amplitude * sign;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(x1, y1);
      ctx.closePath();
      if (i % 2 === 0) {
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  } else {
    // Draw zigzag stroke
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (let i = 0; i < numZigs; i++) {
      const tMid = (i + 0.5) / numZigs;
      const sign = i % 2 === 0 ? 1 : -1;
      const peakX = startX + dx * tMid + Math.cos(perpAngle) * amplitude * sign;
      const peakY = startY + dy * tMid + Math.sin(perpAngle) * amplitude * sign;
      ctx.lineTo(peakX, peakY);
    }
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

export const zigzag: FrameGenerator = {
  name: 'zigzag',
  displayName: 'Zigzag / Chevron Border',
  description: 'Repeating V-shapes along edges',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const amplitude = (params.amplitude as number) ?? 12;
    const frequency = (params.frequency as number) ?? 12;
    const lineWidth = (params.lineWidth as number) ?? 2;
    const color = (params.color as string) ?? '#333333';
    const rows = (params.rows as number) ?? 1;
    const filled = (params.filled as number) ?? 0;

    const rgba = hexToRgba(color);

    ctx.save();
    ctx.strokeStyle = rgba;
    ctx.fillStyle = rgba;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';

    const baseInset = amplitude + lineWidth;

    for (let row = 0; row < rows; row++) {
      const inset = baseInset + row * (amplitude * 2 + 4);

      // Top edge
      drawZigzagLine(ctx, 0, inset, width, inset, amplitude, frequency * 4, !!filled);
      // Bottom edge
      drawZigzagLine(ctx, 0, height - inset, width, height - inset, amplitude, frequency * 4, !!filled);
      // Left edge
      drawZigzagLine(ctx, inset, 0, inset, height, amplitude, frequency * 2, !!filled);
      // Right edge
      drawZigzagLine(ctx, width - inset, 0, width - inset, height, amplitude, frequency * 2, !!filled);
    }

    ctx.restore();
  },
};
