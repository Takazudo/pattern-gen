import type { ParamDef, PatternOptions } from './types.js';

/**
 * Read a parameter value from options.params, falling back to the paramDef default.
 * Validates and clamps values based on param type:
 * - slider: clamps to min/max bounds
 * - select: falls back to default if value isn't a valid option
 * - toggle: falls back to default if value isn't 0 or 1
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

  switch (def.type) {
    case 'slider':
      return Math.max(def.min, Math.min(def.max, value));
    case 'select': {
      const validValues = def.options.map((o) => o.value);
      return validValues.includes(value) ? value : def.defaultValue;
    }
    case 'toggle':
      return (value === 0 || value === 1) ? value : def.defaultValue;
    default:
      return value;
  }
}
