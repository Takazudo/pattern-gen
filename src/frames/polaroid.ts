import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { resetShadow } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'topSideWidth',
    label: 'Top/Side Width',
    type: 'slider',
    min: 10,
    max: 40,
    step: 1,
    defaultValue: 20,
  },
  {
    key: 'bottomWidth',
    label: 'Bottom Width',
    type: 'slider',
    min: 40,
    max: 120,
    step: 1,
    defaultValue: 80,
  },
  {
    key: 'borderColor',
    label: 'Border Color',
    type: 'color',
    defaultValue: '#f5f5f0',
  },
  {
    key: 'shadowEnabled',
    label: 'Shadow',
    type: 'toggle',
    defaultValue: 1,
  },
  {
    key: 'shadowBlur',
    label: 'Shadow Blur',
    type: 'slider',
    min: 0,
    max: 30,
    step: 1,
    defaultValue: 15,
  },
  {
    key: 'rotation',
    label: 'Rotation',
    type: 'slider',
    min: -15,
    max: 15,
    step: 0.5,
    defaultValue: 0,
  },
];

export const polaroid: FrameGenerator = {
  name: 'polaroid',
  displayName: 'Polaroid / Instant Photo',
  description: 'White border wider on bottom, mimicking instant photo',
  paramDefs,
  render(ctx, options, params) {
    const { width, height } = options;
    const topSideWidth = (params.topSideWidth as number) ?? 20;
    const bottomWidth = (params.bottomWidth as number) ?? 80;
    const borderColor = (params.borderColor as string) ?? '#f5f5f0';
    const shadowEnabled = (params.shadowEnabled as number) ?? 1;
    const shadowBlur = (params.shadowBlur as number) ?? 15;
    const rotation = (params.rotation as number) ?? 0;

    ctx.save();

    const cx = width / 2;
    const cy = height / 2;
    const rad = (rotation * Math.PI) / 180;

    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.translate(-cx, -cy);

    // Drop shadow behind the polaroid frame
    if (shadowEnabled) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
    }

    // Draw outer frame
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    // Cut out the inner content area
    const innerLeft = topSideWidth;
    const innerTop = topSideWidth;
    const innerRight = width - topSideWidth;
    const innerBottom = height - bottomWidth;
    ctx.moveTo(innerLeft, innerTop);
    ctx.lineTo(innerLeft, innerBottom);
    ctx.lineTo(innerRight, innerBottom);
    ctx.lineTo(innerRight, innerTop);
    ctx.closePath();
    ctx.fill('evenodd');

    // Reset shadow for the inner frame line
    resetShadow(ctx);

    // Subtle inner border line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(innerLeft, innerTop, innerRight - innerLeft, innerBottom - innerTop);

    ctx.restore();
  },
};
