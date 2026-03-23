import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { withAlpha } from '../core/color-utils.js';

const paramDefs: ParamDef[] = [
  { type: 'select', key: 'curveCount', label: 'Curve Count', options: [{ value: 2, label: '2 curves' }, { value: 3, label: '3 curves' }, { value: 4, label: '4 curves' }], defaultValue: 2 },
  { type: 'slider', key: 'lineWidth', label: 'Line Width', min: 0.3, max: 2, step: 0.1, defaultValue: 0.8 },
  { type: 'slider', key: 'penDistance', label: 'Pen Distance', min: 0.2, max: 1.2, step: 0.05, defaultValue: 0.7 },
];

/**
 * Spirograph/guilloche engraving patterns.
 * Draws parametric hypotrochoid curves — the intricate overlapping
 * patterns seen on banknotes and security documents.
 */
export const guilloche: PatternGenerator = {
  name: 'guilloche',
  displayName: 'Guilloche',
  description: 'Spirograph engraving patterns — intricate parametric curves like banknote designs',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;

    // Number of overlaid curves
    const numCurves = getParam(options, paramDefs, 'curveCount');

    for (let c = 0; c < numCurves; c++) {
      const color = fgColors[c % fgColors.length];
      const alpha = 0.5 + rand() * 0.3;

      // Hypotrochoid parameters: x = (R-r)*cos(t) + d*cos(t*(R-r)/r)
      //                          y = (R-r)*sin(t) - d*sin(t*(R-r)/r)
      const R = maxRadius * (0.6 + rand() * 0.4); // Outer radius
      const rDivisor = 2 + Math.floor(rand() * 8);  // Makes r a rational fraction of R
      const r = R / rDivisor;
      const penDistanceFactor = getParam(options, paramDefs, 'penDistance');
      const d = r * penDistanceFactor; // Pen distance from center of inner circle

      // Number of revolutions needed to complete the pattern
      // For a hypotrochoid, pattern repeats after LCM(R,r)/r revolutions of the inner circle
      const gcdVal = gcd(Math.round(R * 100), Math.round(r * 100));
      const revolutions = Math.round(r * 100) / gcdVal;
      const totalAngle = revolutions * Math.PI * 2;

      // Step size — scale with canvas size, not just zoom/angle
      // At 1200px canvas, ~8000 segments is visually indistinguishable from 50000
      const sizeScale = Math.min(width, height) / 800;
      const steps = Math.min(Math.floor(8000 * sizeScale), Math.max(1000, Math.floor(totalAngle * 20 * zoom)));
      const dt = totalAngle / steps;

      // Pre-compute constants used in the hot loop
      const Rr = R - r;
      const ratio = Rr / r;

      ctx.strokeStyle = withAlpha(color, alpha);
      ctx.lineWidth = Math.max(0.3, getParam(options, paramDefs, 'lineWidth') / zoom);

      const path = new Path2D();

      for (let i = 0; i <= steps; i++) {
        const t = i * dt;
        const x = cx + Rr * Math.cos(t) + d * Math.cos(t * ratio);
        const y = cy + Rr * Math.sin(t) - d * Math.sin(t * ratio);

        if (i === 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }

      ctx.stroke(path);
    }
  },
};

/** Greatest common divisor (Euclidean algorithm) */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
