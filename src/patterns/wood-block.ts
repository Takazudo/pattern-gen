import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { createNoise2D, fbm } from '../core/noise.js';
import { hexToRgb, rgbToHex, darken } from '../core/color-utils.js';
import { shuffleArray } from '../core/array-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'gridDivisions', label: 'Grid Divisions', min: 10, max: 40, step: 1, defaultValue: 20 },
  { type: 'slider', key: 'noiseScale', label: 'Noise Scale', min: 0.001, max: 0.01, step: 0.001, defaultValue: 0.003 },
  { type: 'slider', key: 'gradientColors', label: 'Gradient Colors', min: 2, max: 4, step: 1, defaultValue: 2 },
  { type: 'slider', key: 'shadowIntensity', label: 'Shadow Intensity', min: 0.2, max: 1.0, step: 0.05, defaultValue: 0.6 },
];

/**
 * Wood Block pattern — Diamond-rotated square grid with color gradients
 * forming mountain/wave shapes. Inspired by wooden block wall art.
 *
 * Each block is a rotated square (diamond orientation) with:
 * - Color determined by noise-based gradient field
 * - Subtle depth shadow suggesting 3D relief
 * - Wood-grain-like slight color variation per block
 */
export const woodBlock: PatternGenerator = {
  name: 'wood-block',
  displayName: 'Wood Block',
  description: 'Diamond grid with gradient color mountains — inspired by wooden block art',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);
    const noise = createNoise2D(rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Grid parameters — block size adjusted by zoom
    const gridDivisions = getParam(options, paramDefs, 'gridDivisions');
    const baseBlockSize = Math.max(width, height) / gridDivisions;
    const blockSize = baseBlockSize / zoom;
    const halfBlock = blockSize / 2;

    // Noise scale for the gradient field
    const noiseScale = getParam(options, paramDefs, 'noiseScale') * zoom;

    // Choose gradient colors from palette for the mountain shapes
    const numGradientColors = getParam(options, paramDefs, 'gradientColors');
    const shuffled = shuffleArray(fgColors, rand);
    const gradientColors = shuffled.slice(0, numGradientColors);

    // Gradient center positions (where the color mountains peak)
    const centers: { x: number; y: number; color: string }[] = [];
    for (let i = 0; i < numGradientColors; i++) {
      centers.push({
        x: rand() * width,
        y: rand() * height,
        color: gradientColors[i],
      });
    }

    // Shadow direction
    const shadowDx = blockSize * 0.06;
    const shadowDy = blockSize * 0.06;

    // Calculate grid extent to cover the canvas (diamond orientation = 45deg rotation)
    const diagonal = Math.sqrt(2) * Math.max(width, height);
    const cols = Math.ceil(diagonal / blockSize) + 4;
    const rows = Math.ceil(diagonal / blockSize) + 4;

    // Center offset
    const offsetX = width / 2;
    const offsetY = height / 2;

    // Pre-parse bg color and hoist constant params
    const [bgR, bgG, bgB] = hexToRgb(bg);
    const shadowIntensity = getParam(options, paramDefs, 'shadowIntensity');

    for (let row = -Math.floor(rows / 2); row <= Math.floor(rows / 2); row++) {
      for (let col = -Math.floor(cols / 2); col <= Math.floor(cols / 2); col++) {
        // Diamond grid: rotate coordinates by 45 degrees
        const gridX = col * blockSize;
        const gridY = row * blockSize;
        const cos45 = Math.SQRT1_2;
        const sin45 = Math.SQRT1_2;
        const cx = offsetX + gridX * cos45 - gridY * sin45;
        const cy = offsetY + gridX * sin45 + gridY * cos45;

        // Skip blocks entirely outside canvas (with margin)
        if (cx < -blockSize || cx > width + blockSize ||
            cy < -blockSize || cy > height + blockSize) continue;

        // Noise-based value for color selection
        const noiseVal = fbm(noise, cx * noiseScale, cy * noiseScale, 4);
        const normalized = (noiseVal + 1) / 2; // 0-1

        // Find closest gradient center and blend
        let closestDist = Infinity;
        let closestColor = gradientColors[0];
        let secondColor = gradientColors[0];
        let secondDist = Infinity;

        for (const center of centers) {
          const dx = cx - center.x;
          const dy = cy - center.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < closestDist) {
            secondDist = closestDist;
            secondColor = closestColor;
            closestDist = d;
            closestColor = center.color;
          } else if (d < secondDist) {
            secondDist = d;
            secondColor = center.color;
          }
        }

        // Blend between closest and second closest by noise
        const blendT = Math.max(0, Math.min(1, normalized));
        const [r1, g1, b1] = hexToRgb(closestColor);
        const [r2, g2, b2] = hexToRgb(secondColor);
        const baseR = r1 + (r2 - r1) * blendT;
        const baseG = g1 + (g2 - g1) * blendT;
        const baseB = b1 + (b2 - b1) * blendT;

        // Distance from nearest center affects brightness (farther = darker toward bg)
        const maxDist = Math.max(width, height) * 0.6;
        const distFactor = Math.max(0, 1 - closestDist / maxDist);
        const brightness = 0.3 + distFactor * 0.7;

        // Per-block variation (simulates wood grain uniqueness)
        const variation = 0.9 + rand() * 0.2;

        const finalR = baseR * brightness * variation;
        const finalG = baseG * brightness * variation;
        const finalB = baseB * brightness * variation;

        // Blend with background for distant blocks
        const bgBlend = Math.max(0, 1 - distFactor * 1.5);
        const blockR = finalR + (bgR - finalR) * bgBlend;
        const blockG = finalG + (bgG - finalG) * bgBlend;
        const blockB = finalB + (bgB - finalB) * bgBlend;

        const blockColor = rgbToHex(blockR, blockG, blockB);
        const shadowColor = darken(blockColor, shadowIntensity);

        // Draw diamond block (rotated square)
        // Shadow first
        ctx.fillStyle = shadowColor;
        ctx.beginPath();
        ctx.moveTo(cx + shadowDx, cy - halfBlock + shadowDy);
        ctx.lineTo(cx + halfBlock + shadowDx, cy + shadowDy);
        ctx.lineTo(cx + shadowDx, cy + halfBlock + shadowDy);
        ctx.lineTo(cx - halfBlock + shadowDx, cy + shadowDy);
        ctx.closePath();
        ctx.fill();

        // Block face
        ctx.fillStyle = blockColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy - halfBlock);
        ctx.lineTo(cx + halfBlock, cy);
        ctx.lineTo(cx, cy + halfBlock);
        ctx.lineTo(cx - halfBlock, cy);
        ctx.closePath();
        ctx.fill();

        // Subtle edge highlight (top-left edges lighter)
        const highlightColor = rgbToHex(
          Math.min(255, blockR * 1.15),
          Math.min(255, blockG * 1.15),
          Math.min(255, blockB * 1.15),
        );
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - halfBlock, cy);
        ctx.lineTo(cx, cy - halfBlock);
        ctx.stroke();

        // Bottom-right edge darker
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + halfBlock, cy);
        ctx.lineTo(cx, cy + halfBlock);
        ctx.stroke();
      }
    }
  },
};
