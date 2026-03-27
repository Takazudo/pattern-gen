import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'cornerRadius',
    label: 'Corner Radius',
    type: 'slider',
    min: 10,
    max: 100,
    step: 1,
    defaultValue: 30,
  },
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 2,
    max: 30,
    step: 1,
    defaultValue: 6,
  },
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#333333',
  },
  {
    key: 'fillColor',
    label: 'Fill Color',
    type: 'color',
    defaultValue: '#ffffff00',
  },
  {
    key: 'shadowBlur',
    label: 'Shadow Blur',
    type: 'slider',
    min: 0,
    max: 30,
    step: 1,
    defaultValue: 0,
  },
  {
    key: 'shadowColor',
    label: 'Shadow Color',
    type: 'color',
    defaultValue: '#00000080',
  },
];

export const roundedCorner: FrameGenerator = {
  name: 'rounded-corner',
  displayName: 'Rounded Corner Frame',
  description: 'Soft modern border with pronounced rounded corners',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const cornerRadius = (params.cornerRadius as number) ?? 30;
    const borderWidth = (params.borderWidth as number) ?? 6;
    const color = (params.color as string) ?? '#333333';
    const fillColor = (params.fillColor as string) ?? '#ffffff00';
    const shadowBlur = (params.shadowBlur as number) ?? 0;
    const shadowColor = (params.shadowColor as string) ?? '#00000080';

    ctx.save();

    const half = borderWidth / 2;
    const x = half;
    const y = half;
    const w = width - borderWidth;
    const h = height - borderWidth;

    if (w <= 0 || h <= 0) {
      ctx.restore();
      return;
    }

    // Apply shadow if enabled
    if (shadowBlur > 0) {
      ctx.shadowBlur = shadowBlur;
      ctx.shadowColor = hexToRgba(shadowColor);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Fill the border band if fillColor has alpha
    const fillRgba = hexToRgba(fillColor);
    if (fillColor.length > 7 && fillColor.slice(7, 9) !== '00') {
      ctx.fillStyle = fillRgba;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, cornerRadius);
      // Cut out the inner area
      const innerInset = borderWidth;
      const ix = half + innerInset;
      const iy = half + innerInset;
      const iw = w - 2 * innerInset;
      const ih = h - 2 * innerInset;
      const innerRadius = Math.max(0, cornerRadius - innerInset);
      if (iw > 0 && ih > 0) {
        ctx.roundRect(ix, iy, iw, ih, innerRadius);
      }
      ctx.fill('evenodd');
    } else if (fillColor.length <= 7) {
      // Fully opaque fill
      ctx.fillStyle = fillRgba;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, cornerRadius);
      const innerInset = borderWidth;
      const ix = half + innerInset;
      const iy = half + innerInset;
      const iw = w - 2 * innerInset;
      const ih = h - 2 * innerInset;
      const innerRadius = Math.max(0, cornerRadius - innerInset);
      if (iw > 0 && ih > 0) {
        ctx.roundRect(ix, iy, iw, ih, innerRadius);
      }
      ctx.fill('evenodd');
    }

    // Reset shadow for stroke (shadow was already applied on fill)
    if (shadowBlur === 0) {
      ctx.shadowBlur = 0;
    }

    // Draw the border stroke
    ctx.strokeStyle = hexToRgba(color);
    ctx.lineWidth = borderWidth;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, cornerRadius);
    ctx.stroke();

    ctx.restore();
  },
};
