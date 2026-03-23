import type { ParamDef, PatternOptions, SliderParamDef } from '../core/types.js';

/**
 * Generate random values for specified slider param keys when the user hasn't
 * explicitly set them. This adds seed-based diversity to patterns that would
 * otherwise produce nearly identical output for different seeds.
 *
 * Only slider params are randomized (select/toggle don't have continuous ranges).
 * When a key IS set in options.params, it is left unchanged.
 */
export function randomizeDefaults(
  options: PatternOptions,
  paramDefs: ParamDef[],
  rand: () => number,
  keysToRandomize: string[],
): PatternOptions {
  let modified = false;
  const newParams: Record<string, number> = { ...options.params };

  for (const key of keysToRandomize) {
    if (options.params && Object.hasOwn(options.params, key)) continue;

    const def = paramDefs.find((d) => d.key === key);
    if (!def || def.type !== 'slider') continue;

    const slider = def as SliderParamDef;
    newParams[key] = slider.min + rand() * (slider.max - slider.min);
    modified = true;
  }

  return modified ? { ...options, params: newParams } : options;
}
