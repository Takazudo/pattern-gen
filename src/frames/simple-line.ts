import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 2,
    max: 40,
    step: 1,
    defaultValue: 8,
  },
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#000000',
  },
  {
    key: 'lineStyle',
    label: 'Line Style',
    type: 'select',
    options: [
      { value: 0, label: 'Solid' },
      { value: 1, label: 'Dashed' },
      { value: 2, label: 'Double' },
    ],
    defaultValue: 0,
  },
  {
    key: 'inset',
    label: 'Inset',
    type: 'slider',
    min: 0,
    max: 60,
    step: 1,
    defaultValue: 0,
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

export const simpleLine: FrameGenerator = {
  name: 'simple-line',
  displayName: 'Simple Line Border',
  description: 'Clean rectangular border with configurable width and style',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const borderWidth = (params.borderWidth as number) ?? 8;
    const color = (params.color as string) ?? '#000000';
    const lineStyle = (params.lineStyle as number) ?? 0;
    const inset = (params.inset as number) ?? 0;
    const cornerRadius = (params.cornerRadius as number) ?? 0;

    ctx.save();

    const rgba = hexToRgba(color);
    ctx.strokeStyle = rgba;
    ctx.lineWidth = borderWidth;

    const half = borderWidth / 2;
    const x = inset + half;
    const y = inset + half;
    const w = width - 2 * (inset + half);
    const h = height - 2 * (inset + half);

    if (w <= 0 || h <= 0) {
      ctx.restore();
      return;
    }

    if (lineStyle === 2) {
      // Double line: draw two thinner strokes
      const outerLw = borderWidth * 0.35;
      const innerLw = borderWidth * 0.35;
      const gap = borderWidth * 0.3;

      ctx.lineWidth = outerLw;
      ctx.setLineDash([]);
      const outerHalf = outerLw / 2;
      const ox = inset + outerHalf;
      const oy = inset + outerHalf;
      const ow = width - 2 * (inset + outerHalf);
      const oh = height - 2 * (inset + outerHalf);
      if (ow > 0 && oh > 0) {
        ctx.beginPath();
        ctx.roundRect(ox, oy, ow, oh, cornerRadius);
        ctx.stroke();
      }

      ctx.lineWidth = innerLw;
      const innerOffset = outerLw + gap;
      const innerHalf = innerLw / 2;
      const ix = inset + innerOffset + innerHalf;
      const iy = inset + innerOffset + innerHalf;
      const iw = width - 2 * (inset + innerOffset + innerHalf);
      const ih = height - 2 * (inset + innerOffset + innerHalf);
      if (iw > 0 && ih > 0) {
        ctx.beginPath();
        ctx.roundRect(ix, iy, iw, ih, cornerRadius);
        ctx.stroke();
      }
    } else {
      if (lineStyle === 1) {
        ctx.setLineDash([borderWidth * 2, borderWidth]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, cornerRadius);
      ctx.stroke();
    }

    ctx.restore();
  },
};
