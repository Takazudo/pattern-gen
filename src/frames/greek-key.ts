import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'unitSize',
    label: 'Unit Size',
    type: 'slider',
    min: 10,
    max: 40,
    step: 1,
    defaultValue: 20,
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
    key: 'cornerSquare',
    label: 'Corner Square',
    type: 'toggle',
    defaultValue: 1,
  },
];

export const greekKey: FrameGenerator = {
  name: 'greek-key',
  displayName: 'Greek Key / Meander Border',
  description: 'Classic repeating right-angle spiral pattern',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const unitSize = (params.unitSize as number) ?? 20;
    const lineWidth = (params.lineWidth as number) ?? 2;
    const color = (params.color as string) ?? '#333333';
    const cornerSquare = (params.cornerSquare as number) ?? 1;

    ctx.save();

    const rgba = hexToRgba(color);
    ctx.strokeStyle = rgba;
    ctx.fillStyle = rgba;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    const u = unitSize;
    const halfU = u / 2;

    // Draw meander unit along a baseline
    // Each unit: a squared spiral pattern
    const drawMeanderUnit = (x: number, y: number, size: number): void => {
      const s = size;
      const q = s / 4;
      ctx.beginPath();
      // Squared spiral: outer to inner
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x + s, y + q);
      ctx.lineTo(x + q, y + q);
      ctx.lineTo(x + q, y + s - q);
      ctx.lineTo(x + s - q, y + s - q);
      ctx.lineTo(x + s - q, y);
      ctx.stroke();
    };

    // Top edge
    const topY = halfU;
    const topCount = Math.floor((width - 2 * u) / u);
    const topStartX = (width - topCount * u) / 2;
    for (let i = 0; i < topCount; i++) {
      ctx.save();
      ctx.translate(topStartX + i * u, topY - halfU);
      drawMeanderUnit(0, 0, u);
      ctx.restore();
    }

    // Bottom edge (flipped)
    const bottomY = height - halfU;
    for (let i = 0; i < topCount; i++) {
      ctx.save();
      ctx.translate(topStartX + i * u + u, bottomY + halfU);
      ctx.scale(-1, -1);
      drawMeanderUnit(0, 0, u);
      ctx.restore();
    }

    // Left edge (rotated 90° CCW)
    const leftX = halfU;
    const sideCount = Math.floor((height - 2 * u) / u);
    const sideStartY = (height - sideCount * u) / 2;
    for (let i = 0; i < sideCount; i++) {
      ctx.save();
      ctx.translate(leftX - halfU, sideStartY + i * u + u);
      ctx.rotate(-Math.PI / 2);
      drawMeanderUnit(0, 0, u);
      ctx.restore();
    }

    // Right edge (rotated 90° CW)
    const rightX = width - halfU;
    for (let i = 0; i < sideCount; i++) {
      ctx.save();
      ctx.translate(rightX + halfU, sideStartY + i * u);
      ctx.rotate(Math.PI / 2);
      drawMeanderUnit(0, 0, u);
      ctx.restore();
    }

    // Corner squares
    if (cornerSquare === 1) {
      const cs = u;
      const corners = [
        [topStartX - cs, 0],
        [topStartX + topCount * u, 0],
        [topStartX + topCount * u, height - cs],
        [topStartX - cs, height - cs],
      ];

      ctx.lineWidth = lineWidth;
      for (const [cx, cy] of corners) {
        ctx.strokeRect(cx, cy, cs, cs);
        // Inner square
        const innerInset = cs * 0.25;
        ctx.strokeRect(cx + innerInset, cy + innerInset, cs - 2 * innerInset, cs - 2 * innerInset);
      }
    }

    ctx.restore();
  },
};
