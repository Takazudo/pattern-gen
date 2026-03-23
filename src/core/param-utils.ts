import type { ParamDef, PatternOptions } from './types.js';

/**
 * Read a parameter value from options.params, falling back to the paramDef default.
 * Clamps slider values to their min/max bounds.
 * Patterns call this instead of reading hardcoded constants.
 */
export function getParam(
  options: PatternOptions,
  paramDefs: ParamDef[],
  key: string,
): number {
  const def = paramDefs.find((d) => d.key === key);
  if (!def) throw new Error(`Unknown param key: "${key}"`);

  const value = (options.params && Object.hasOwn(options.params, key))
    ? options.params[key]
    : def.defaultValue;

  // Clamp slider values to defined bounds
  if (def.type === 'slider') {
    return Math.max(def.min, Math.min(def.max, value));
  }

  return value;
}
