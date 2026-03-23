// Core utilities
export { hashString } from './core/hash.js';
export { createRandom } from './core/seeded-random.js';
export { createNoise2D, fbm } from './core/noise.js';
export { hexToRgb, rgbToHex, lerpColor, darken, lighten, withAlpha } from './core/color-utils.js';
export {
  COLOR_SCHEMES,
  colorSchemesByKey,
  normalizeSchemeKey,
  getColorSchemeNames,
} from './core/color-schemes.js';
export type { ColorScheme, Palette } from './core/color-schemes.js';

// Types
export type { PatternGenerator, PatternOptions, GenerateOptions } from './core/types.js';

// Pattern registry
export { patternRegistry, patternsByName, getPatternNames } from './patterns/index.js';

// Renderer
export { renderPattern, renderPatternToCanvas } from './renderer.js';
export type { RenderResult } from './renderer.js';
