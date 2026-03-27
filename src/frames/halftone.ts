import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'gridSpacing',
    label: 'Grid Spacing',
    type: 'slider',
    min: 5,
    max: 20,
    step: 1,
    defaultValue: 10,
  },
  {
    key: 'maxDotRadius',
    label: 'Max Dot Radius',
    type: 'slider',
    min: 2,
    max: 10,
    step: 0.5,
    defaultValue: 5,
  },
  {
    key: 'minDotRadius',
    label: 'Min Dot Radius',
    type: 'slider',
    min: 0,
    max: 4,
    step: 0.5,
    defaultValue: 1,
  },
  {
    key: 'color',
    label: 'Color',
    type: 'color',
    defaultValue: '#333333',
  },
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 15,
    max: 60,
    step: 1,
    defaultValue: 35,
  },
  {
    key: 'gradientDirection',
    label: 'Gradient',
    type: 'select',
    options: [
      { value: 0, label: 'Outer to Inner' },
      { value: 1, label: 'Uniform' },
    ],
    defaultValue: 0,
  },
  {
    key: 'dotShape',
    label: 'Dot Shape',
    type: 'select',
    options: [
      { value: 0, label: 'Circle' },
      { value: 1, label: 'Diamond' },
      { value: 2, label: 'Square' },
    ],
    defaultValue: 0,
  },
];

function isInBorder(
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
): boolean {
  return x < borderWidth || x > width - borderWidth || y < borderWidth || y > height - borderWidth;
}

function distanceFromContentEdge(
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
): number {
  // Distance from the inner content rectangle edge (0 = at content edge, borderWidth = at canvas edge)
  const dLeft = borderWidth - x;
  const dRight = x - (width - borderWidth);
  const dTop = borderWidth - y;
  const dBottom = y - (height - borderWidth);
  return Math.max(dLeft, dRight, dTop, dBottom, 0);
}

export const halftone: FrameGenerator = {
  name: 'halftone',
  displayName: 'Halftone / Ben-Day Dots',
  description: 'Border filled with halftone dot pattern',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const gridSpacing = (params.gridSpacing as number) ?? 10;
    const maxDotRadius = (params.maxDotRadius as number) ?? 5;
    const minDotRadius = (params.minDotRadius as number) ?? 1;
    const color = (params.color as string) ?? '#333333';
    const borderWidth = (params.borderWidth as number) ?? 35;
    const gradientDirection = (params.gradientDirection as number) ?? 0;
    const dotShape = (params.dotShape as number) ?? 0;

    const rgba = hexToRgba(color);

    ctx.save();
    ctx.fillStyle = rgba;

    for (let x = gridSpacing / 2; x < width; x += gridSpacing) {
      for (let y = gridSpacing / 2; y < height; y += gridSpacing) {
        if (!isInBorder(x, y, width, height, borderWidth)) continue;

        let radius: number;
        if (gradientDirection === 0) {
          // Gradient: larger dots toward outer edge
          const dist = distanceFromContentEdge(x, y, width, height, borderWidth);
          const t = Math.min(dist / borderWidth, 1);
          radius = minDotRadius + (maxDotRadius - minDotRadius) * t;
        } else {
          // Uniform size
          radius = (maxDotRadius + minDotRadius) / 2;
        }

        if (radius <= 0) continue;

        if (dotShape === 0) {
          // Circle
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (dotShape === 1) {
          // Diamond (rotated square)
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-radius * 0.7, -radius * 0.7, radius * 1.4, radius * 1.4);
          ctx.restore();
        } else {
          // Square
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      }
    }

    ctx.restore();
  },
};
