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

export { centerDetentToZoom, zoomToCenterDetent } from './core/center-detent.js';

// Types
export type { PatternGenerator, PatternOptions, GenerateOptions, ParamDef, SliderParamDef, SelectParamDef, ToggleParamDef } from './core/types.js';

// Param utilities
export { getParam } from './core/param-utils.js';
export { shuffleArray } from './core/array-utils.js';
export { randomizeDefaults, getEffectiveParams } from './core/randomize-defaults.js';

// Pattern registry
export { patternRegistry, patternsByName, getPatternNames } from './patterns/index.js';

// Renderer
export { renderPattern, renderPatternToCanvas, renderOgpFromConfig, renderOgpEditorFromConfig } from './renderer.js';
export type { RenderResult } from './renderer.js';

// OGP config
export { serializeOgpConfig, parseOgpConfig, OGP_WIDTH, OGP_HEIGHT } from './core/ogp-config.js';
export type { OgpConfig, OgpCropRegion } from './core/ogp-config.js';

// OGP editor config
export { serializeOgpEditorConfig, parseOgpEditorConfig } from './core/ogp-editor-config.js';
export type { OgpEditorConfig, EditorLayer, ImageLayerData, TextLayerData, LayerTransform } from './core/ogp-editor-config.js';
