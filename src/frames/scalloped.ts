import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'scallopsPerSide',
    label: 'Scallops Per Side',
    type: 'slider',
    min: 5,
    max: 30,
    step: 1,
    defaultValue: 15,
  },
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 10,
    max: 50,
    step: 1,
    defaultValue: 25,
  },
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#555555',
  },
  {
    key: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { value: 0, label: 'Inward' },
      { value: 1, label: 'Outward' },
    ],
    defaultValue: 0,
  },
  {
    key: 'fillBorder',
    label: 'Fill Border',
    type: 'toggle',
    defaultValue: 1,
  },
];

export const scalloped: FrameGenerator = {
  name: 'scalloped',
  displayName: 'Scalloped Edge Frame',
  description: 'Border with repeating semicircular wave pattern on inner edge',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const scallopsPerSide = (params.scallopsPerSide as number) ?? 15;
    const borderWidth = (params.borderWidth as number) ?? 25;
    const color = (params.color as string) ?? '#555555';
    const direction = (params.direction as number) ?? 0;
    const fillBorder = (params.fillBorder as number) ?? 1;

    ctx.save();

    const rgba = hexToRgba(color);

    // Calculate scallop sizes for horizontal and vertical edges
    const hScallopWidth = width / scallopsPerSide;
    const vScallopCount = Math.max(1, Math.round(height / hScallopWidth));

    // The scalloped inner edge baseline
    const inward = direction === 0;

    // Build the scalloped border path
    ctx.beginPath();

    // Outer rectangle
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    // Inner scalloped path (drawn counter-clockwise for evenodd)
    ctx.moveTo(borderWidth, borderWidth);

    // Top inner edge: scallops along the top (left to right)
    for (let i = 0; i < scallopsPerSide; i++) {
      const cx = borderWidth + (i + 0.5) * ((width - 2 * borderWidth) / scallopsPerSide);
      const baseY = borderWidth;
      const arcRadius = (width - 2 * borderWidth) / scallopsPerSide / 2;
      if (inward) {
        ctx.arc(cx, baseY, arcRadius, Math.PI, 0, false);
      } else {
        ctx.arc(cx, baseY, arcRadius, Math.PI, 0, true);
      }
    }

    // Right inner edge: scallops along the right (top to bottom)
    const rightX = width - borderWidth;
    for (let i = 0; i < vScallopCount; i++) {
      const cy = borderWidth + (i + 0.5) * ((height - 2 * borderWidth) / vScallopCount);
      const arcRadius = (height - 2 * borderWidth) / vScallopCount / 2;
      if (inward) {
        ctx.arc(rightX, cy, arcRadius, -Math.PI / 2, Math.PI / 2, true);
      } else {
        ctx.arc(rightX, cy, arcRadius, -Math.PI / 2, Math.PI / 2, false);
      }
    }

    // Bottom inner edge: scallops along the bottom (right to left)
    const bottomY = height - borderWidth;
    for (let i = scallopsPerSide - 1; i >= 0; i--) {
      const cx = borderWidth + (i + 0.5) * ((width - 2 * borderWidth) / scallopsPerSide);
      const arcRadius = (width - 2 * borderWidth) / scallopsPerSide / 2;
      if (inward) {
        ctx.arc(cx, bottomY, arcRadius, 0, Math.PI, false);
      } else {
        ctx.arc(cx, bottomY, arcRadius, 0, Math.PI, true);
      }
    }

    // Left inner edge: scallops along the left (bottom to top)
    const leftX = borderWidth;
    for (let i = vScallopCount - 1; i >= 0; i--) {
      const cy = borderWidth + (i + 0.5) * ((height - 2 * borderWidth) / vScallopCount);
      const arcRadius = (height - 2 * borderWidth) / vScallopCount / 2;
      if (inward) {
        ctx.arc(leftX, cy, arcRadius, Math.PI / 2, -Math.PI / 2, true);
      } else {
        ctx.arc(leftX, cy, arcRadius, Math.PI / 2, -Math.PI / 2, false);
      }
    }

    ctx.closePath();

    if (fillBorder === 1) {
      ctx.fillStyle = rgba;
      ctx.fill('evenodd');
    } else {
      ctx.strokeStyle = rgba;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  },
};
