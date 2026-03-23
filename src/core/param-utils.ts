import type { ParamDef, PatternOptions } from './types.js';

/**
 * Read a parameter value from options.params, falling back to the paramDef default.
 * Patterns call this instead of reading hardcoded constants.
 */
export function getParam(
  options: PatternOptions,
  paramDefs: ParamDef[],
  key: string,
): number {
  if (options.params && Object.hasOwn(options.params, key)) {
    return options.params[key];
  }
  const def = paramDefs.find((d) => d.key === key);
  if (!def) throw new Error(`Unknown param key: "${key}"`);
  return def.defaultValue;
}
