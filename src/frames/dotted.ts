import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'dotRadius',
    label: 'Dot Radius',
    type: 'slider',
    min: 1,
    max: 8,
    step: 0.5,
    defaultValue: 3,
  },
  {
    key: 'spacing',
    label: 'Spacing',
    type: 'slider',
    min: 4,
    max: 20,
    step: 1,
    defaultValue: 10,
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
    key: 'arrangement',
    label: 'Arrangement',
    type: 'select',
    options: [
      { value: 0, label: 'Grid' },
      { value: 1, label: 'Staggered' },
    ],
    defaultValue: 0,
  },
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 8,
    max: 50,
    step: 1,
    defaultValue: 20,
  },
];

export const dotted: FrameGenerator = {
  name: 'dotted',
  displayName: 'Dotted / Stippled Border',
  description: 'Border made of evenly-spaced dots',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const dotRadius = (params.dotRadius as number) ?? 3;
    const spacing = (params.spacing as number) ?? 10;
    const color = (params.color as string) ?? '#333333';
    const rows = (params.rows as number) ?? 1;
    const arrangement = (params.arrangement as number) ?? 0;
    const borderWidth = (params.borderWidth as number) ?? 20;

    ctx.save();
    ctx.fillStyle = hexToRgba(color);

    const step = dotRadius * 2 + spacing;
    const rowSpacing = dotRadius * 2 + spacing;

    // Calculate row positions centered within borderWidth
    const totalRowsHeight = rows * rowSpacing - spacing;
    const rowStartOffset = (borderWidth - totalRowsHeight) / 2 + dotRadius;

    const drawDot = (x: number, y: number): void => {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    };

    // Top edge
    for (let row = 0; row < rows; row++) {
      const y = rowStartOffset + row * rowSpacing;
      const staggerOffset = arrangement === 1 && row % 2 === 1 ? step / 2 : 0;
      for (let x = dotRadius + staggerOffset; x < width - dotRadius; x += step) {
        drawDot(x, y);
      }
    }

    // Bottom edge
    for (let row = 0; row < rows; row++) {
      const y = height - borderWidth + rowStartOffset + row * rowSpacing;
      const staggerOffset = arrangement === 1 && row % 2 === 1 ? step / 2 : 0;
      for (let x = dotRadius + staggerOffset; x < width - dotRadius; x += step) {
        drawDot(x, y);
      }
    }

    // Left edge (skip corners already drawn)
    for (let row = 0; row < rows; row++) {
      const x = rowStartOffset + row * rowSpacing;
      const staggerOffset = arrangement === 1 && row % 2 === 1 ? step / 2 : 0;
      for (let y = borderWidth + dotRadius + staggerOffset; y < height - borderWidth - dotRadius; y += step) {
        drawDot(x, y);
      }
    }

    // Right edge (skip corners already drawn)
    for (let row = 0; row < rows; row++) {
      const x = width - borderWidth + rowStartOffset + row * rowSpacing;
      const staggerOffset = arrangement === 1 && row % 2 === 1 ? step / 2 : 0;
      for (let y = borderWidth + dotRadius + staggerOffset; y < height - borderWidth - dotRadius; y += step) {
        drawDot(x, y);
      }
    }

    ctx.restore();
  },
};
