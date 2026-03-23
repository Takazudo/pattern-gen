import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { createNoise2D } from '../core/noise.js';
import { withAlpha } from '../core/color-utils.js';

/**
 * Ikat-inspired pattern with intentionally blurred/offset edges
 * simulating dye bleeding in woven textiles.
 *
 * Creates a base diamond/stripe geometric pattern, then uses noise
 * to displace edges, producing the characteristic ikat fuzzing where
 * colors bleed into each other.
 */
export const ikat: PatternGenerator = {
  name: 'ikat',
  displayName: 'Ikat',
  description: 'Woven textile pattern with noise-displaced edges simulating dye bleeding',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    const noise = createNoise2D(rand);

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Pattern parameters
    const baseBandWidth = Math.max(width, height) / 20;
    const bandWidth = baseBandWidth / zoom;
    const diamondHeight = bandWidth * 2.5;

    // Noise parameters for edge displacement
    const noiseScale = 0.015 * zoom;
    const displacementAmount = bandWidth * 0.4;

    // Choose colors for bands
    const shuffled = [...fgColors];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const bandColors = shuffled.slice(0, Math.min(4, shuffled.length));

    // Draw vertical bands with noise-displaced edges
    const totalBandWidth = bandWidth * bandColors.length * 2;
    const numRepeats = Math.ceil(width / totalBandWidth) + 2;

    for (let repeat = -1; repeat < numRepeats; repeat++) {
      const baseX = repeat * totalBandWidth;

      for (let b = 0; b < bandColors.length; b++) {
        const color = bandColors[b];
        const stripX = baseX + b * bandWidth * 2;

        // Draw the band row by row with noise displacement
        for (let y = 0; y < height; y += 2) {
          // Noise-based horizontal displacement
          const dx = noise(stripX * noiseScale, y * noiseScale) * displacementAmount;

          const x0 = stripX + dx;
          const bw = bandWidth + noise((stripX + 100) * noiseScale, y * noiseScale) * displacementAmount * 0.5;

          ctx.fillStyle = withAlpha(color, 0.7 + noise(stripX * noiseScale * 0.5, y * noiseScale * 0.5) * 0.2);
          ctx.fillRect(x0, y, bw, 3);
        }
      }
    }

    // Overlay diamond/lozenge motifs (characteristic ikat pattern)
    const diamondCols = Math.ceil(width / (bandWidth * 4)) + 2;
    const diamondRows = Math.ceil(height / diamondHeight) + 2;
    const accentColor = bandColors.length > 1 ? bandColors[bandColors.length - 1] : fgColors[0];

    for (let row = -1; row < diamondRows; row++) {
      for (let col = -1; col < diamondCols; col++) {
        const cx = col * bandWidth * 4 + (row % 2 === 0 ? 0 : bandWidth * 2);
        const cy = row * diamondHeight;

        // Draw diamond with noisy edges
        ctx.fillStyle = withAlpha(accentColor, 0.5);
        ctx.beginPath();

        const steps = 32;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          let dx: number, dy: number;

          if (t <= 0.25) {
            // Top to right
            const s = t / 0.25;
            dx = s * bandWidth * 1.5;
            dy = -diamondHeight / 2 + s * diamondHeight / 2;
          } else if (t <= 0.5) {
            // Right to bottom
            const s = (t - 0.25) / 0.25;
            dx = (1 - s) * bandWidth * 1.5;
            dy = s * diamondHeight / 2;
          } else if (t <= 0.75) {
            // Bottom to left
            const s = (t - 0.5) / 0.25;
            dx = -s * bandWidth * 1.5;
            dy = (1 - s) * diamondHeight / 2;
          } else {
            // Left to top
            const s = (t - 0.75) / 0.25;
            dx = -(1 - s) * bandWidth * 1.5;
            dy = -s * diamondHeight / 2;
          }

          // Apply noise displacement for ikat blur effect
          const noiseDisp = noise((cx + dx) * noiseScale * 2, (cy + dy) * noiseScale * 2) * displacementAmount * 0.6;

          const px = cx + dx + noiseDisp;
          const py = cy + dy + noise((cx + dx + 50) * noiseScale * 2, (cy + dy + 50) * noiseScale * 2) * displacementAmount * 0.3;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }

        ctx.closePath();
        ctx.fill();
      }
    }

    // Add subtle horizontal thread lines for woven texture
    ctx.strokeStyle = withAlpha(bg, 0.1);
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  },
};
