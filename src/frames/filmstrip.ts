import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

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
    const bandWidth = (params.bandWidth as number) ?? 35;
    const holeWidth = (params.holeWidth as number) ?? 12;
    const holeHeight = (params.holeHeight as number) ?? 10;
    const holeSpacing = (params.holeSpacing as number) ?? 25;
    const bandColor = (params.bandColor as string) ?? '#1a1a1a';
    const holeColor = (params.holeColor as string) ?? '#ffffff';
    const sides = (params.sides as number) ?? 0;
    const holeRadius = (params.holeRadius as number) ?? 2;

    ctx.save();

    const bandRgba = hexToRgba(bandColor);
    const holeRgba = hexToRgba(holeColor);

    // Draw horizontal bands (top and bottom)
    ctx.fillStyle = bandRgba;
    ctx.fillRect(0, 0, width, bandWidth);
    ctx.fillRect(0, height - bandWidth, width, bandWidth);

    // Draw sprocket holes on horizontal bands
    const holeCenterY_top = bandWidth / 2;
    const holeCenterY_bottom = height - bandWidth / 2;
    const holeStep = holeWidth + holeSpacing;
    const holeCount = Math.floor(width / holeStep);
    const holeStartX = (width - holeCount * holeStep + holeSpacing) / 2;

    ctx.fillStyle = holeRgba;
    for (let i = 0; i < holeCount; i++) {
      const cx = holeStartX + i * holeStep + holeWidth / 2;

      // Top band holes
      drawRoundedRect(ctx, cx - holeWidth / 2, holeCenterY_top - holeHeight / 2, holeWidth, holeHeight, holeRadius);
      ctx.fill();

      // Bottom band holes
      drawRoundedRect(ctx, cx - holeWidth / 2, holeCenterY_bottom - holeHeight / 2, holeWidth, holeHeight, holeRadius);
      ctx.fill();
    }

    // Draw vertical bands if all-four mode
    if (sides === 1) {
      ctx.fillStyle = bandRgba;
      ctx.fillRect(0, bandWidth, bandWidth, height - 2 * bandWidth);
      ctx.fillRect(width - bandWidth, bandWidth, bandWidth, height - 2 * bandWidth);

      // Draw sprocket holes on vertical bands
      const holeCenterX_left = bandWidth / 2;
      const holeCenterX_right = width - bandWidth / 2;
      const vHoleStep = holeHeight + holeSpacing;
      const vHoleCount = Math.floor((height - 2 * bandWidth) / vHoleStep);
      const vHoleStartY = bandWidth + ((height - 2 * bandWidth) - vHoleCount * vHoleStep + holeSpacing) / 2;

      ctx.fillStyle = holeRgba;
      for (let i = 0; i < vHoleCount; i++) {
        const cy = vHoleStartY + i * vHoleStep + holeHeight / 2;

        // Left band holes (rotated: width becomes height, height becomes width)
        drawRoundedRect(ctx, holeCenterX_left - holeHeight / 2, cy - holeWidth / 2, holeHeight, holeWidth, holeRadius);
        ctx.fill();

        // Right band holes
        drawRoundedRect(ctx, holeCenterX_right - holeHeight / 2, cy - holeWidth / 2, holeHeight, holeWidth, holeRadius);
        ctx.fill();
      }
    }

    ctx.restore();
  },
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}
