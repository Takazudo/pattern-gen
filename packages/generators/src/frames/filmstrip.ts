import type { FrameGenerator, FrameParamDef } from '@takazudo/pattern-gen-core';
import { hexToRgba } from './frame-utils.js';
import { getFrameParam } from './get-frame-param.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'bandWidth',
    label: 'Band Width',
    type: 'slider',
    min: 20,
    max: 60,
    step: 1,
    defaultValue: 35,
  },
  {
    key: 'holeWidth',
    label: 'Hole Width',
    type: 'slider',
    min: 8,
    max: 20,
    step: 1,
    defaultValue: 12,
  },
  {
    key: 'holeHeight',
    label: 'Hole Height',
    type: 'slider',
    min: 8,
    max: 16,
    step: 1,
    defaultValue: 10,
  },
  {
    key: 'holeSpacing',
    label: 'Hole Spacing',
    type: 'slider',
    min: 15,
    max: 40,
    step: 1,
    defaultValue: 25,
  },
  {
    key: 'bandColor',
    label: 'Band Color',
    type: 'color',
    defaultValue: '#1a1a1a',
  },
  {
    key: 'holeColor',
    label: 'Hole Color',
    type: 'color',
    defaultValue: '#ffffff',
  },
  {
    key: 'sides',
    label: 'Sides',
    type: 'select',
    options: [
      { value: 0, label: 'Top & Bottom' },
      { value: 1, label: 'All Four' },
    ],
    defaultValue: 0,
  },
  {
    key: 'holeRadius',
    label: 'Hole Radius',
    type: 'slider',
    min: 0,
    max: 5,
    step: 0.5,
    defaultValue: 2,
  },
];

export const filmstrip: FrameGenerator = {
  name: 'filmstrip',
  displayName: 'Filmstrip / Sprocket Border',
  description: 'Mimics 35mm film stock with dark bands and sprocket holes',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const bandWidth = getFrameParam(params, 'bandWidth', 35);
    const holeWidth = getFrameParam(params, 'holeWidth', 12);
    const holeHeight = getFrameParam(params, 'holeHeight', 10);
    const holeSpacing = getFrameParam(params, 'holeSpacing', 25);
    const bandColor = getFrameParam(params, 'bandColor', '#1a1a1a');
    const sides = getFrameParam(params, 'sides', 0);
    const holeRadius = getFrameParam(params, 'holeRadius', 2);

    ctx.save();

    const bandRgba = hexToRgba(bandColor);

    // Use evenodd fill: band rect + hole rects = holes are transparent (reveal content)
    const holeStep = holeWidth + holeSpacing;
    const holeCount = Math.floor(width / holeStep);
    const holeStartX = (width - holeCount * holeStep + holeSpacing) / 2;
    const holeCenterY_top = bandWidth / 2;
    const holeCenterY_bottom = height - bandWidth / 2;

    // Top band with holes
    ctx.beginPath();
    ctx.rect(0, 0, width, bandWidth);
    for (let i = 0; i < holeCount; i++) {
      const cx = holeStartX + i * holeStep + holeWidth / 2;
      addRoundedRect(ctx, cx - holeWidth / 2, holeCenterY_top - holeHeight / 2, holeWidth, holeHeight, holeRadius);
    }
    ctx.fillStyle = bandRgba;
    ctx.fill('evenodd');

    // Bottom band with holes
    ctx.beginPath();
    ctx.rect(0, height - bandWidth, width, bandWidth);
    for (let i = 0; i < holeCount; i++) {
      const cx = holeStartX + i * holeStep + holeWidth / 2;
      addRoundedRect(ctx, cx - holeWidth / 2, holeCenterY_bottom - holeHeight / 2, holeWidth, holeHeight, holeRadius);
    }
    ctx.fill('evenodd');

    // Vertical bands if all-four mode
    if (sides === 1) {
      const vHoleStep = holeHeight + holeSpacing;
      const vHoleCount = Math.floor((height - 2 * bandWidth) / vHoleStep);
      const vHoleStartY = bandWidth + ((height - 2 * bandWidth) - vHoleCount * vHoleStep + holeSpacing) / 2;
      const holeCenterX_left = bandWidth / 2;
      const holeCenterX_right = width - bandWidth / 2;

      // Left band with holes
      ctx.beginPath();
      ctx.rect(0, bandWidth, bandWidth, height - 2 * bandWidth);
      for (let i = 0; i < vHoleCount; i++) {
        const cy = vHoleStartY + i * vHoleStep + holeHeight / 2;
        addRoundedRect(ctx, holeCenterX_left - holeHeight / 2, cy - holeWidth / 2, holeHeight, holeWidth, holeRadius);
      }
      ctx.fill('evenodd');

      // Right band with holes
      ctx.beginPath();
      ctx.rect(width - bandWidth, bandWidth, bandWidth, height - 2 * bandWidth);
      for (let i = 0; i < vHoleCount; i++) {
        const cy = vHoleStartY + i * vHoleStep + holeHeight / 2;
        addRoundedRect(ctx, holeCenterX_right - holeHeight / 2, cy - holeWidth / 2, holeHeight, holeWidth, holeRadius);
      }
      ctx.fill('evenodd');
    }

    ctx.restore();
  },
};

/** Add a rounded rect sub-path (no beginPath — appends to current path for evenodd) */
function addRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.roundRect(x, y, w, h, radius);
}
