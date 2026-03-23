import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { hexToRgb } from '../core/color-utils.js';
import { randomizeDefaults } from './randomize-defaults.js';

const paramDefs: ParamDef[] = [
  { key: 'sourceCount', label: 'Source Count', type: 'slider', min: 2, max: 12, step: 1, defaultValue: 6 },
  { key: 'frequency', label: 'Frequency', type: 'slider', min: 0.005, max: 0.15, step: 0.005, defaultValue: 0.04 },
];

/**
 * Wave Interference pattern — Multiple sine wave sources at random positions,
 * summed to create interference patterns with concentric ring overlaps.
 */
export const waveInterference: PatternGenerator = {
  name: 'wave-interference',
  displayName: 'Wave Interference',
  description: 'Overlapping sine wave sources creating interference patterns',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    // Seed-based randomization for visual diversity
    options = randomizeDefaults(options, paramDefs, options.rand, [
      'sourceCount', 'frequency',
    ]);

    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Seed-based frequency spread factor (0.5x–2.5x variation between sources)
    const freqSpread = 0.5 + rand() * 2.0;

    // Generate wave sources
    const sourceCount = getParam(options, paramDefs, 'sourceCount');
    const baseFreq = getParam(options, paramDefs, 'frequency');
    const sources: { x: number; y: number; freq: number; phase: number; amplitude: number }[] = [];
    for (let i = 0; i < sourceCount; i++) {
      sources.push({
        x: rand() * width,
        y: rand() * height,
        freq: (baseFreq + rand() * baseFreq * freqSpread) * zoom,
        phase: rand() * Math.PI * 2,
        // Seed-based amplitude variation per source (0.3–1.0)
        amplitude: 0.3 + rand() * 0.7,
      });
    }

    // Pre-parse all palette colors
    const allColors = [bg, ...fgColors].map((hex) => hexToRgb(hex));

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Sum sine waves from all sources (with per-source amplitude)
        let sum = 0;
        for (const src of sources) {
          const dx = x - src.x;
          const dy = y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          sum += src.amplitude * Math.sin(dist * src.freq + src.phase);
        }

        // Normalize sum to [0, 1]
        // Max possible absolute sum is sourceCount, but typically lower
        const normalized = (sum / sourceCount + 1) / 2;

        // Map to color index
        const colorIdx = Math.floor(normalized * (allColors.length - 1));
        const clampedIdx = Math.max(0, Math.min(allColors.length - 1, colorIdx));
        const [r, g, b] = allColors[clampedIdx];

        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  },
};
