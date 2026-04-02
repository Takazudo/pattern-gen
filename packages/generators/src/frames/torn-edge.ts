import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
import { getFrameParam } from './get-frame-param.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'roughness',
    label: 'Roughness',
    type: 'slider',
    min: 2,
    max: 20,
    step: 1,
    defaultValue: 8,
  },
  {
    key: 'frequency',
    label: 'Frequency',
    type: 'slider',
    min: 10,
    max: 60,
    step: 1,
    defaultValue: 30,
  },
  {
    key: 'borderWidth',
    label: 'Border Width',
    type: 'slider',
    min: 15,
    max: 60,
    step: 1,
    defaultValue: 30,
  },
  {
    key: 'paperColor',
    label: 'Paper Color',
    type: 'color',
    defaultValue: '#f5f0e8',
  },
  {
    key: 'seed',
    label: 'Seed',
    type: 'slider',
    min: 1,
    max: 100,
    step: 1,
    defaultValue: 42,
  },
];

function generateTornPoints(
  rand: () => number,
  start: number,
  end: number,
  fixed: number,
  isHorizontal: boolean,
  roughness: number,
  numPoints: number,
  inward: boolean,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const length = end - start;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const along = start + t * length;
    const offset = (rand() - 0.5) * 2 * roughness * (inward ? 1 : -1);

    if (isHorizontal) {
      points.push({ x: along, y: fixed + offset });
    } else {
      points.push({ x: fixed + offset, y: along });
    }
  }

  return points;
}

export const tornEdge: FrameGenerator = {
  name: 'torn-edge',
  displayName: 'Torn / Deckle Edge',
  description: 'Rough irregular edge resembling hand-torn paper',
  paramDefs,
  render(ctx, options, params) {
    const { width, height, rand } = options;
    const roughness = getFrameParam(params, 'roughness', 8);
    const frequency = getFrameParam(params, 'frequency', 30);
    const borderWidth = getFrameParam(params, 'borderWidth', 30);
    const paperColor = getFrameParam(params, 'paperColor', '#f5f0e8');

    // Consume some rand values based on seed param to vary output
    const seed = getFrameParam(params, 'seed', 42);
    for (let i = 0; i < seed; i++) rand();

    const numPointsH = Math.max(10, Math.round((width / 1200) * frequency * 4));
    const numPointsV = Math.max(10, Math.round((height / 630) * frequency * 4));

    ctx.save();

    // Generate torn edge points for each side (inner edge of border)
    const topEdge = generateTornPoints(rand, 0, width, borderWidth, true, roughness, numPointsH, true);
    const bottomEdge = generateTornPoints(rand, 0, width, height - borderWidth, true, roughness, numPointsH, false);
    const leftEdge = generateTornPoints(rand, 0, height, borderWidth, false, roughness, numPointsV, true);
    const rightEdge = generateTornPoints(rand, 0, height, width - borderWidth, false, roughness, numPointsV, false);

    // Draw the border by filling the area between canvas edges and torn path
    ctx.fillStyle = paperColor;

    // Top border
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, borderWidth + roughness);
    for (let i = topEdge.length - 1; i >= 0; i--) {
      ctx.lineTo(topEdge[i].x, topEdge[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Bottom border
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, height - borderWidth - roughness);
    for (let i = bottomEdge.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomEdge[i].x, bottomEdge[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Left border
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.lineTo(borderWidth + roughness, height);
    for (let i = leftEdge.length - 1; i >= 0; i--) {
      ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Right border
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(width - borderWidth - roughness, height);
    for (let i = rightEdge.length - 1; i >= 0; i--) {
      ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  },
};
