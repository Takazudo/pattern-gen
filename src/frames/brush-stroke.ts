import type { FrameGenerator, FrameParamDef } from '../core/frame-types.js';
import { hexToRgba } from './frame-utils.js';

const paramDefs: FrameParamDef[] = [
  {
    key: 'strokeWidth',
    label: 'Stroke Width',
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
    defaultValue: '#1a1a1a',
  },
  {
    key: 'irregularity',
    label: 'Irregularity',
    type: 'slider',
    min: 2,
    max: 15,
    step: 1,
    defaultValue: 7,
  },
  {
    key: 'opacity',
    label: 'Opacity',
    type: 'slider',
    min: 30,
    max: 100,
    step: 1,
    defaultValue: 80,
  },
  {
    key: 'splatter',
    label: 'Splatter',
    type: 'toggle',
    defaultValue: 1,
  },
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    options: [
      { value: 0, label: 'Single Pass' },
      { value: 1, label: 'Overlapping' },
      { value: 2, label: 'Calligraphic' },
    ],
    defaultValue: 0,
  },
];

function drawBrushSide(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  strokeWidth: number,
  irregularity: number,
  color: string,
  opacity: number,
  style: number,
  splatter: boolean,
): void {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / length;
  const perpY = dx / length;

  const numSegments = Math.max(20, Math.round(length / 8));
  const passes = style === 1 ? 3 : style === 2 ? 2 : 1;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;

  for (let pass = 0; pass < passes; pass++) {
    const passOffset = style === 1 ? (pass - 1) * strokeWidth * 0.3 : pass * strokeWidth * 0.15;

    ctx.beginPath();
    const firstX = startX + perpX * passOffset;
    const firstY = startY + perpY * passOffset;
    ctx.moveTo(firstX, firstY);

    for (let i = 1; i <= numSegments; i++) {
      const t = i / numSegments;
      const baseX = startX + dx * t;
      const baseY = startY + dy * t;

      // Add irregularity perpendicular to the stroke direction
      const offset = (rand() - 0.5) * 2 * irregularity + passOffset;

      const px = baseX + perpX * offset;
      const py = baseY + perpY * offset;
      ctx.lineTo(px, py);
    }

    // Vary line width along the stroke for calligraphic style
    if (style === 2) {
      ctx.lineWidth = strokeWidth * (0.3 + pass * 0.5);
      ctx.globalAlpha = opacity / 100 * (1 - pass * 0.3);
    } else {
      // Vary alpha between passes
      ctx.lineWidth = strokeWidth * (0.6 + rand() * 0.4);
      ctx.globalAlpha = (opacity / 100) * (style === 1 ? 0.4 + pass * 0.15 : 0.7 + rand() * 0.3);
    }

    ctx.stroke();
  }

  // Ink splatter
  if (splatter) {
    ctx.globalAlpha = (opacity / 100) * 0.5;
    ctx.fillStyle = color;

    const numSplatters = Math.round(length / 30);
    for (let i = 0; i < numSplatters; i++) {
      const t = rand();
      const baseX = startX + dx * t;
      const baseY = startY + dy * t;
      const splatDist = strokeWidth * (0.8 + rand() * 1.5);
      const splatAngle = rand() * Math.PI * 2;
      const sx = baseX + Math.cos(splatAngle) * splatDist;
      const sy = baseY + Math.sin(splatAngle) * splatDist;
      const splatR = 0.5 + rand() * 2;

      ctx.beginPath();
      ctx.arc(sx, sy, splatR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const brushStroke: FrameGenerator = {
  name: 'brush-stroke',
  displayName: 'Brush Stroke / Ink Wash',
  description: 'Border looks like painted with a wide brush',
  paramDefs,
  render(ctx, options, params) {
    const { width, height, rand } = options;
    const strokeWidth = (params.strokeWidth as number) ?? 25;
    const color = (params.color as string) ?? '#1a1a1a';
    const irregularity = (params.irregularity as number) ?? 7;
    const opacity = (params.opacity as number) ?? 80;
    const splatter = (params.splatter as number) ?? 1;
    const style = (params.style as number) ?? 0;

    const rgba = hexToRgba(color);
    const inset = strokeWidth / 2 + 5;

    ctx.save();

    // Top edge
    drawBrushSide(ctx, rand, inset, inset, width - inset, inset, strokeWidth, irregularity, rgba, opacity, style, !!splatter);
    // Right edge
    drawBrushSide(ctx, rand, width - inset, inset, width - inset, height - inset, strokeWidth, irregularity, rgba, opacity, style, !!splatter);
    // Bottom edge
    drawBrushSide(ctx, rand, width - inset, height - inset, inset, height - inset, strokeWidth, irregularity, rgba, opacity, style, !!splatter);
    // Left edge
    drawBrushSide(ctx, rand, inset, height - inset, inset, inset, strokeWidth, irregularity, rgba, opacity, style, !!splatter);

    ctx.restore();
  },
};
