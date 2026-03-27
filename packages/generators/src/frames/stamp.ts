import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
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

    // Build the entire stamp border as one path using evenodd fill rule:
    // outer rect + inner rect + perforation circles = border with holes
    // No destination-out or OffscreenCanvas needed (works in Node.js too).
    ctx.beginPath();

    // Outer rectangle (clockwise)
    ctx.rect(0, 0, width, height);

    // Inner content rectangle (creates center cutout via evenodd)
    const inner = {
      x: borderWidth,
      y: borderWidth,
      w: width - borderWidth * 2,
      h: height - borderWidth * 2,
    };
    ctx.rect(inner.x, inner.y, inner.w, inner.h);

    // Perforation circles along outer edge (each circle subtracts from border via evenodd)
    const numTop = Math.floor(width / perfSpacing);
    const topOffset = (width - (numTop - 1) * perfSpacing) / 2;
    for (let i = 0; i < numTop; i++) {
      const px = topOffset + i * perfSpacing;
      // Top edge
      ctx.moveTo(px + perfRadius, 0);
      ctx.arc(px, 0, perfRadius, 0, Math.PI * 2);
      // Bottom edge
      ctx.moveTo(px + perfRadius, height);
      ctx.arc(px, height, perfRadius, 0, Math.PI * 2);
    }

    const numLeft = Math.floor(height / perfSpacing);
    const leftOffset = (height - (numLeft - 1) * perfSpacing) / 2;
    for (let i = 0; i < numLeft; i++) {
      const py = leftOffset + i * perfSpacing;
      // Left edge
      ctx.moveTo(perfRadius, py);
      ctx.arc(0, py, perfRadius, 0, Math.PI * 2);
      // Right edge
      ctx.moveTo(width + perfRadius, py);
      ctx.arc(width, py, perfRadius, 0, Math.PI * 2);
    }

    ctx.fillStyle = hexToRgba(borderColor);
    ctx.fill('evenodd');

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
