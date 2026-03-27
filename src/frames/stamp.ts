import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'perforationRadius',
    label: 'Perforation Radius',
    type: 'slider',
    min: 2,
    max: 8,
    step: 0.5,
    defaultValue: 4,
  },
  {
    key: 'perforationSpacing',
    label: 'Perforation Spacing',
    type: 'slider',
    min: 8,
    max: 25,
    step: 1,
    defaultValue: 15,
  },
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 15,
    max: 50,
    step: 1,
    defaultValue: 25,
  },
  {
    key: 'borderColor',
    label: 'Border Color',
    type: 'color',
    defaultValue: '#f5f0e8',
  },
  {
    key: 'innerLine',
    label: 'Inner Line',
    type: 'toggle',
    defaultValue: 1,
  },
  {
    key: 'innerLineColor',
    label: 'Inner Line Color',
    type: 'color',
    defaultValue: '#cc4444',
  },
];

export const stamp: FrameGenerator = {
  name: 'stamp',
  displayName: 'Stamp / Postage Border',
  description: 'Perforated edges like a postage stamp',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const perfRadius = (params.perforationRadius as number) ?? 4;
    const perfSpacing = (params.perforationSpacing as number) ?? 15;
    const borderWidth = (params.borderWidth as number) ?? 25;
    const borderColor = (params.borderColor as string) ?? '#f5f0e8';
    const innerLine = (params.innerLine as number) ?? 1;
    const innerLineColor = (params.innerLineColor as string) ?? '#cc4444';

    ctx.save();

    // Build the outer border shape with bumpy perforated edges
    ctx.beginPath();

    // Outer rectangle (full canvas)
    ctx.rect(0, 0, width, height);

    // Inner content rectangle (to cut out)
    const inner = {
      x: borderWidth,
      y: borderWidth,
      w: width - borderWidth * 2,
      h: height - borderWidth * 2,
    };
    ctx.rect(inner.x, inner.y, inner.w, inner.h);

    ctx.fillStyle = borderColor;
    ctx.fill('evenodd');

    // Cut perforations along the outer edge using destination-out
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';

    // Top edge perforations
    const numTop = Math.floor(width / perfSpacing);
    const topOffset = (width - (numTop - 1) * perfSpacing) / 2;
    for (let i = 0; i < numTop; i++) {
      ctx.beginPath();
      ctx.arc(topOffset + i * perfSpacing, 0, perfRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom edge perforations
    for (let i = 0; i < numTop; i++) {
      ctx.beginPath();
      ctx.arc(topOffset + i * perfSpacing, height, perfRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Left edge perforations
    const numLeft = Math.floor(height / perfSpacing);
    const leftOffset = (height - (numLeft - 1) * perfSpacing) / 2;
    for (let i = 0; i < numLeft; i++) {
      ctx.beginPath();
      ctx.arc(0, leftOffset + i * perfSpacing, perfRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Right edge perforations
    for (let i = 0; i < numLeft; i++) {
      ctx.beginPath();
      ctx.arc(width, leftOffset + i * perfSpacing, perfRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';

    // Inner decorative line (dashed rectangle)
    if (innerLine) {
      const lineInset = borderWidth * 0.6;
      ctx.strokeStyle = hexToRgba(innerLineColor);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(lineInset, lineInset, width - lineInset * 2, height - lineInset * 2);
      ctx.setLineDash([]);
    }

    ctx.restore();
  },
};
