import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#000000',
  },
  {
    key: 'strength',
    label: 'Strength',
    type: 'slider',
    min: 10,
    max: 100,
    step: 1,
    defaultValue: 60,
  },
  {
    key: 'shape',
    label: 'Shape',
    type: 'select',
    options: [
      { value: 0, label: 'Rectangular' },
      { value: 1, label: 'Elliptical' },
    ],
    defaultValue: 1,
  },
  {
    key: 'fadeStart',
    label: 'Fade Start',
    type: 'slider',
    min: 20,
    max: 80,
    step: 1,
    defaultValue: 50,
  },
  {
    key: 'softness',
    label: 'Softness',
    type: 'slider',
    min: 10,
    max: 100,
    step: 1,
    defaultValue: 50,
  },
];

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex || hex[0] !== '#' || hex.length < 7) return { r: 0, g: 0, b: 0 };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
}

export const vignette: FrameGenerator = {
  name: 'vignette',
  displayName: 'Vignette / Fade-to-Color',
  description: 'Content gradually fades to a solid color at edges',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const color = (params.color as string) ?? '#000000';
    const strength = (params.strength as number) ?? 60;
    const shape = (params.shape as number) ?? 1;
    const fadeStart = (params.fadeStart as number) ?? 50;
    const softness = (params.softness as number) ?? 50;

    const { r, g, b } = parseHexRgb(color);
    const maxAlpha = strength / 100;

    ctx.save();

    if (shape === 1) {
      // Elliptical vignette using radial gradient
      const cx = width / 2;
      const cy = height / 2;
      // Diagonal length to cover corners
      const maxRadius = Math.sqrt(cx * cx + cy * cy);
      const innerRadius = maxRadius * (fadeStart / 100);

      const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, maxRadius);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      // Softness controls how quickly the fade ramps up
      const midStop = 0.3 + (1 - softness / 100) * 0.5;
      gradient.addColorStop(Math.min(midStop, 0.95), `rgba(${r}, ${g}, ${b}, ${maxAlpha * 0.5})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${maxAlpha})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Rectangular vignette using 4 linear gradients
      const fadeSize = (1 - fadeStart / 100) * Math.min(width, height) * 0.5;
      const adjustedFade = fadeSize * (softness / 100 + 0.5);

      // Top edge
      const topGrad = ctx.createLinearGradient(0, 0, 0, adjustedFade);
      topGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${maxAlpha})`);
      topGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, adjustedFade);

      // Bottom edge
      const bottomGrad = ctx.createLinearGradient(0, height, 0, height - adjustedFade);
      bottomGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${maxAlpha})`);
      bottomGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, height - adjustedFade, width, adjustedFade);

      // Left edge
      const leftGrad = ctx.createLinearGradient(0, 0, adjustedFade, 0);
      leftGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${maxAlpha})`);
      leftGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, adjustedFade, height);

      // Right edge
      const rightGrad = ctx.createLinearGradient(width, 0, width - adjustedFade, 0);
      rightGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${maxAlpha})`);
      rightGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = rightGrad;
      ctx.fillRect(width - adjustedFade, 0, adjustedFade, height);
    }

    ctx.restore();
  },
};
