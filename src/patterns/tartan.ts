import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { withAlpha } from '../core/color-utils.js';
import { getParam } from '../core/param-utils.js';

const paramDefs: ParamDef[] = [
  {
    key: 'baseStripeWidth',
    label: 'Stripe Width',
    type: 'slider',
    min: 5,
    max: 60,
    step: 1,
    defaultValue: 30,
  },
  {
    key: 'stripeCount',
    label: 'Stripe Count',
    type: 'slider',
    min: 3,
    max: 20,
    step: 1,
    defaultValue: 8,
  },
  {
    key: 'stripeAlpha',
    label: 'Stripe Alpha',
    type: 'slider',
    min: 0.1,
    max: 0.9,
    step: 0.05,
    defaultValue: 0.5,
  },
];

/**
 * Tartan/plaid woven pattern.
 * Draws semi-transparent horizontal and vertical stripes of varying widths
 * using palette colors. The overlap creates the characteristic plaid look.
 */
export const tartan: PatternGenerator = {
  name: 'tartan',
  displayName: 'Tartan',
  description: 'Woven plaid pattern with overlapping semi-transparent stripes',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Generate stripe pattern definition (widths + colors)
    const baseStripeWidth = Math.max(width, height) / getParam(options, paramDefs, 'baseStripeWidth');
    const stripeWidth = baseStripeWidth / zoom;

    // Build a stripe sequence that will tile
    const stripeCount = getParam(options, paramDefs, 'stripeCount');
    const stripes: { width: number; color: string; alpha: number }[] = [];

    const alphaBase = getParam(options, paramDefs, 'stripeAlpha');
    for (let i = 0; i < stripeCount; i++) {
      const w = stripeWidth * (0.4 + rand() * 1.6); // varied widths
      const color = fgColors[Math.floor(rand() * fgColors.length)];
      const alpha = alphaBase - 0.2 + rand() * 0.4; // vary around base alpha
      stripes.push({ width: w, color, alpha });
    }

    // Draw vertical stripes (repeating tile)
    ctx.save();
    let x = 0;
    while (x < width) {
      for (const stripe of stripes) {
        if (x > width) break;
        ctx.fillStyle = withAlpha(stripe.color, stripe.alpha);
        ctx.fillRect(x, 0, stripe.width, height);
        x += stripe.width;
      }
    }
    ctx.restore();

    // Draw horizontal stripes with multiply-like blending
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    let y = 0;
    while (y < height) {
      for (const stripe of stripes) {
        if (y > height) break;
        ctx.fillStyle = withAlpha(stripe.color, stripe.alpha);
        ctx.fillRect(0, y, width, stripe.width);
        y += stripe.width;
      }
    }
    ctx.restore();

    // Add thin accent lines at stripe boundaries for woven texture
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const accentColor = withAlpha(bg, 0.15);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;

    // Vertical accent lines
    x = 0;
    while (x < width) {
      for (const stripe of stripes) {
        if (x > width) break;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        x += stripe.width;
      }
    }

    // Horizontal accent lines
    y = 0;
    while (y < height) {
      for (const stripe of stripes) {
        if (y > height) break;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        y += stripe.width;
      }
    }
    ctx.restore();
  },
};
