import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'inset',
    label: 'Inset',
    type: 'slider',
    min: 10,
    max: 80,
    step: 1,
    defaultValue: 30,
  },
  {
    key: 'cornerRadius',
    label: 'Corner Radius',
    type: 'slider',
    min: 0,
    max: 40,
    step: 1,
    defaultValue: 12,
  },
  {
    key: 'shadowBlur',
    label: 'Shadow Blur',
    type: 'slider',
    min: 5,
    max: 60,
    step: 1,
    defaultValue: 20,
  },
  {
    key: 'shadowOffsetX',
    label: 'Shadow Offset X',
    type: 'slider',
    min: -30,
    max: 30,
    step: 1,
    defaultValue: 5,
  },
  {
    key: 'shadowOffsetY',
    label: 'Shadow Offset Y',
    type: 'slider',
    min: -30,
    max: 30,
    step: 1,
    defaultValue: 8,
  },
  {
    key: 'shadowColor',
    label: 'Shadow Color',
    type: 'color',
    defaultValue: '#00000060',
  },
  {
    key: 'cardColor',
    label: 'Card Color',
    type: 'color',
    defaultValue: '#ffffff',
  },
];

export const dropShadow: FrameGenerator = {
  name: 'drop-shadow',
  displayName: 'Drop Shadow / Elevated Card',
  description: 'Content sits on a card that appears elevated with a soft drop shadow',
  paramDefs,

  render(ctx, options, params) {
    const { width, height } = options;
    const inset = (params.inset as number) ?? 30;
    const cornerRadius = (params.cornerRadius as number) ?? 12;
    const shadowBlur = (params.shadowBlur as number) ?? 20;
    const shadowOffsetX = (params.shadowOffsetX as number) ?? 5;
    const shadowOffsetY = (params.shadowOffsetY as number) ?? 8;
    const shadowColor = (params.shadowColor as string) ?? '#00000060';
    const cardColor = (params.cardColor as string) ?? '#ffffff';

    ctx.save();

    // Fill background area outside the card with a subtle contrasting color
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.fillRect(0, 0, width, height);

    // Card dimensions
    const cx = inset;
    const cy = inset;
    const cw = width - 2 * inset;
    const ch = height - 2 * inset;

    if (cw <= 0 || ch <= 0) {
      ctx.restore();
      return;
    }

    // Draw card with shadow
    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = hexToRgba(shadowColor);
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;

    ctx.fillStyle = hexToRgba(cardColor);
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, cornerRadius);
    ctx.fill();

    // Remove shadow for card border
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Subtle card edge
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, cornerRadius);
    ctx.stroke();

    // Clear the inner area so content shows through
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const clearInset = 1;
    ctx.beginPath();
    ctx.roundRect(
      cx + clearInset,
      cy + clearInset,
      cw - 2 * clearInset,
      ch - 2 * clearInset,
      Math.max(0, cornerRadius - clearInset),
    );
    ctx.fill();
    ctx.restore();

    ctx.restore();
  },
};
