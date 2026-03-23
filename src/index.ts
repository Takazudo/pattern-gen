// Core utilities
export { hashString } from './core/hash.js';
export { createRandom } from './core/seeded-random.js';
export { createNoise2D, fbm } from './core/noise.js';
export { hexToRgb, rgbToHex, lerpColor, darken, lighten, withAlpha, rgbToHsl, hslToRgb } from './core/color-utils.js';
export {
  COLOR_SCHEMES,
  colorSchemesByKey,
  normalizeSchemeKey,
  getColorSchemeNames,
} from './core/color-schemes.js';
export type { ColorScheme, Palette } from './core/color-schemes.js';

export { applyHslAdjust } from './core/hsl-adjust.js';
export type { HslAdjust } from './core/hsl-adjust.js';

// Types
export type { PatternGenerator, PatternOptions, GenerateOptions, ParamDef, SliderParamDef, SelectParamDef, ToggleParamDef } from './core/types.js';

// Param utilities
export { getParam } from './core/param-utils.js';
export { shuffleArray } from './core/array-utils.js';

// Pattern registry
export { patternRegistry, patternsByName, getPatternNames } from './patterns/index.js';

// Renderer
export { renderPattern, renderPatternToCanvas } from './renderer.js';
export type { RenderResult } from './renderer.js';
