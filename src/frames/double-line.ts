import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'outerWidth',
    label: 'Outer Width',
    type: 'slider',
    min: 1,
    max: 10,
    step: 0.5,
    defaultValue: 3,
  },
  {
    key: 'innerWidth',
    label: 'Inner Width',
    type: 'slider',
    min: 1,
    max: 8,
    step: 0.5,
    defaultValue: 1.5,
  },
  {
    key: 'gap',
    label: 'Gap',
    type: 'slider',
    min: 2,
    max: 30,
    step: 1,
    defaultValue: 10,
  },
  {
    key: 'outerColor',
    label: 'Outer Color',
    type: 'color',
    defaultValue: '#333333',
  },
  {
    key: 'innerColor',
    label: 'Inner Color',
    type: 'color',
    defaultValue: '#666666',
  },
  {
    key: 'cornerDots',
    label: 'Corner Dots',
    type: 'toggle',
    defaultValue: 0,
  },
];

export const doubleLine: FrameGenerator = {
  name: 'double-line',
  displayName: 'Double-Line Classical Frame',
  description: 'Two parallel rectangular borders with a gap, like traditional picture frame matting',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const outerWidth = (params.outerWidth as number) ?? 3;
    const innerWidth = (params.innerWidth as number) ?? 1.5;
    const gap = (params.gap as number) ?? 10;
    const outerColor = (params.outerColor as string) ?? '#333333';
    const innerColor = (params.innerColor as string) ?? '#666666';
    const cornerDots = (params.cornerDots as number) ?? 0;

    ctx.save();

    // Outer rectangle
    const outerHalf = outerWidth / 2;
    const ox = outerHalf;
    const oy = outerHalf;
    const ow = width - outerWidth;
    const oh = height - outerWidth;

    if (ow > 0 && oh > 0) {
      ctx.strokeStyle = hexToRgba(outerColor);
      ctx.lineWidth = outerWidth;
      ctx.setLineDash([]);
      ctx.strokeRect(ox, oy, ow, oh);
    }

    // Inner rectangle
    const innerInset = outerWidth + gap;
    const innerHalf = innerWidth / 2;
    const ix = innerInset + innerHalf;
    const iy = innerInset + innerHalf;
    const iw = width - 2 * innerInset - innerWidth;
    const ih = height - 2 * innerInset - innerWidth;

    if (iw > 0 && ih > 0) {
      ctx.strokeStyle = hexToRgba(innerColor);
      ctx.lineWidth = innerWidth;
      ctx.strokeRect(ix, iy, iw, ih);
    }

    // Corner dots at the midpoint of the gap between the two lines
    if (cornerDots === 1) {
      const dotRadius = Math.max(2, (outerWidth + innerWidth) / 2);
      const dotColor = hexToRgba(outerColor);
      ctx.fillStyle = dotColor;

      const midGap = outerWidth + gap / 2;
      const corners = [
        [midGap, midGap],
        [width - midGap, midGap],
        [width - midGap, height - midGap],
        [midGap, height - midGap],
      ];

      for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },
};
