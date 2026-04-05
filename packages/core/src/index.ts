// Hash
export { hashString } from './hash.js';

// PRNG
export { createRandom } from './seeded-random.js';

// Noise
export { createNoise2D, fbm } from './noise.js';

// Color utilities
export {
  hexToRgb,
  rgbToHex,
  lerpColor,
  darken,
  lighten,
  withAlpha,
  rgbToHsl,
  hslToRgb,
} from './color-utils.js';

// Color schemes
export {
  COLOR_SCHEMES,
  colorSchemesByKey,
  normalizeSchemeKey,
  getColorSchemeNames,
} from './color-schemes.js';
export type { ColorScheme, Palette } from './color-schemes.js';

// HSL adjust
export { applyHslAdjust } from './hsl-adjust.js';
export type { HslAdjust } from './hsl-adjust.js';

// Contrast/brightness adjust
export { applyContrastBrightness } from './contrast-brightness.js';
export type { ContrastBrightness } from './contrast-brightness.js';

// Center detent
export { centerDetentToZoom, zoomToCenterDetent } from './center-detent.js';

// Types
export type {
  PatternGenerator,
  PatternOptions,
  GenerateOptions,
  ParamDef,
  SliderParamDef,
  SelectParamDef,
  ToggleParamDef,
} from './types.js';

// Param utilities
export { getParam } from './param-utils.js';

// Array utilities
export { shuffleArray } from './array-utils.js';

// Randomize defaults
export { randomizeDefaults, getEffectiveParams } from './randomize-defaults.js';

// OGP config
export { serializeOgpConfig, parseOgpConfig, OGP_WIDTH, OGP_HEIGHT } from './ogp-config.js';
export type { OgpConfig, OgpCropRegion } from './ogp-config.js';

// Composer config
export {
  serializeComposerConfig,
  parseComposerConfig,
  DEFAULT_LAYER_FILTERS,
  normalizeLayerFilters,
  buildFilterString,
} from './composer-config.js';
export type {
  ComposerConfig,
  EditorLayer,
  ImageLayerData,
  TextLayerData,
  LayerTransform,
  FrameConfig,
  LayerFilters,
} from './composer-config.js';

// Frame types
export type {
  FrameGenerator,
  FrameParamDef,
  FrameRenderOptions,
  SliderFrameParam,
  ColorFrameParam,
  SelectFrameParam,
  ToggleFrameParam,
} from './frame-types.js';

// Aspect config
export { getAspect, getOutputDimensions } from './aspect-config.js';
export type { AspectMode, AspectConfig } from './aspect-config.js';
