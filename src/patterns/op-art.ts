import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';

const paramDefs: ParamDef[] = [
  { type: 'select', key: 'shapeType', label: 'Shape Type', options: [{ value: 0, label: 'Circles' }, { value: 1, label: 'Squares' }], defaultValue: 0 },
  { type: 'slider', key: 'baseSpacing', label: 'Base Spacing', min: 1, max: 15, step: 0.5, defaultValue: 6 },
  { type: 'slider', key: 'bumpStrength', label: 'Bump Strength', min: 0.1, max: 1.5, step: 0.05, defaultValue: 0.55 },
];

/**
 * Riley-style op art — concentric shapes with modulated spacing.
 * Spacing varies sinusoidally to create the illusion of a 3D surface
 * with convex bumps or concave dips.
 */
export const opArt: PatternGenerator = {
  name: 'op-art',
  displayName: 'Op Art',
  description: 'Riley-style concentric shapes with sinusoidal spacing — 3D surface illusion',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const palette = colorScheme.palette;
    const bg = palette[0];
    const fgColors = palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Choose shape type: circles or squares
    const shapeTypeValue = getParam(options, paramDefs, 'shapeType');
    const useCircles = shapeTypeValue === 0;

    // Center of the distortion (1-2 bump points)
    const numBumps = 1 + Math.floor(rand() * 2);
    const bumps: { x: number; y: number; strength: number }[] = [];
    for (let i = 0; i < numBumps; i++) {
      bumps.push({
        x: width * (0.2 + rand() * 0.6),
        y: height * (0.2 + rand() * 0.6),
        strength: getParam(options, paramDefs, 'bumpStrength'),
      });
    }

    const maxDim = Math.max(width, height);
    const baseSpacing = getParam(options, paramDefs, 'baseSpacing') / zoom;
    const numRings = Math.ceil(maxDim / baseSpacing) + 10;

    // Center of the concentric shapes
    const cx = width / 2;
    const cy = height / 2;

    // Pick two alternating colors from palette
    const color1 = fgColors[Math.floor(rand() * fgColors.length)];
    const color2 = fgColors[Math.floor(rand() * fgColors.length)];

    let currentRadius = 0;

    for (let i = 0; i < numRings; i++) {
      // Modulate spacing based on proximity to bump points
      let spacingMod = 1;
      for (const bump of bumps) {
        const dist = Math.abs(currentRadius - Math.sqrt(
          (cx - bump.x) ** 2 + (cy - bump.y) ** 2,
        ));
        const influence = Math.exp(-(dist * dist) / (maxDim * maxDim * 0.02));
        spacingMod += bump.strength * Math.sin(dist * 0.05) * influence;
      }

      const spacing = baseSpacing * Math.max(0.3, Math.min(2.5, spacingMod));
      currentRadius += spacing;

      if (currentRadius > maxDim) break;

      // Alternate colors
      ctx.strokeStyle = (i % 2 === 0) ? color1 : color2;
      ctx.lineWidth = spacing * 0.45;

      if (useCircles) {
        ctx.beginPath();
        ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Concentric squares
        ctx.strokeRect(
          cx - currentRadius,
          cy - currentRadius,
          currentRadius * 2,
          currentRadius * 2,
        );
      }
    }
  },
};
