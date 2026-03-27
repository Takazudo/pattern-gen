import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'glowColor',
    label: 'Glow Color',
    type: 'color',
    defaultValue: '#00ffff',
  },
  {
    key: 'glowRadius',
    label: 'Glow Radius',
    type: 'slider',
    min: 5,
    max: 40,
    step: 1,
    defaultValue: 15,
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
    key: 'layers',
    label: 'Glow Layers',
    type: 'slider',
    min: 3,
    max: 10,
    step: 1,
    defaultValue: 6,
  },
  {
    key: 'inset',
    label: 'Inset',
    type: 'slider',
    min: 5,
    max: 40,
    step: 1,
    defaultValue: 20,
  },
  {
    key: 'cornerRadius',
    label: 'Corner Radius',
    type: 'slider',
    min: 0,
    max: 30,
    step: 1,
    defaultValue: 0,
  },
];

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export const neonGlow: FrameGenerator = {
  name: 'neon-glow',
  displayName: 'Neon Glow Border',
  description: 'Bright glowing line like a neon sign',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const glowColor = (params.glowColor as string) ?? '#00ffff';
    const glowRadius = (params.glowRadius as number) ?? 15;
    const lineWidth = (params.lineWidth as number) ?? 2;
    const layers = (params.layers as number) ?? 6;
    const inset = (params.inset as number) ?? 20;
    const cornerRadius = (params.cornerRadius as number) ?? 0;

    const rgba = hexToRgba(glowColor);

    ctx.save();

    // Draw glow layers from outermost (most diffuse) to innermost (brightest)
    for (let i = 0; i < layers; i++) {
      const t = layers > 1 ? i / (layers - 1) : 1; // 0 = outermost, 1 = innermost
      const alpha = 0.1 + t * 0.6;
      const currentLineWidth = lineWidth + (1 - t) * glowRadius * 0.8;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = rgba;
      ctx.lineWidth = currentLineWidth;
      ctx.lineJoin = 'round';

      roundedRectPath(ctx, inset, inset, width - inset * 2, height - inset * 2, cornerRadius);
      ctx.stroke();
    }

    // Bright core line
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineWidth * 0.5;
    roundedRectPath(ctx, inset, inset, width - inset * 2, height - inset * 2, cornerRadius);
    ctx.stroke();

    ctx.restore();
  },
};
