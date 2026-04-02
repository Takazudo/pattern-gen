import type { ParamDef, PatternOptions, SliderParamDef } from './types.js';

/**
 * Generate random values for slider params when the user hasn't explicitly
 * set them. This adds seed-based diversity so each seed produces visually
 * distinct output.
 *
 * Only slider params are randomized (select/toggle don't have continuous ranges).
 * Values are quantized to the param's step size.
 * When a key IS set in options.params, it is left unchanged.
 *
 * IMPORTANT: Always consumes one rand() per slider param regardless of whether
 * it's overridden — this keeps the PRNG sequence stable when individual params
 * are toggled on/off by the viewer UI.
 *
 * If keysToRandomize is omitted, ALL slider params are randomized.
 */
export function randomizeDefaults(
  options: PatternOptions,
  paramDefs: ParamDef[],
  rand: () => number,
  keysToRandomize?: string[],
): PatternOptions {
  const keys = keysToRandomize ?? paramDefs
    .filter((d) => d.type === 'slider')
    .map((d) => d.key);

  let modified = false;
  const newParams: Record<string, number> = { ...options.params };

  for (const key of keys) {
    const def = paramDefs.find((d) => d.key === key);
    if (!def || def.type !== 'slider') continue;

    // Always consume a rand() value for PRNG stability
    const randomValue = rand();

    // Skip if user explicitly set this param
    if (options.params && Object.hasOwn(options.params, key)) continue;

    const slider = def as SliderParamDef;
    const raw = slider.min + randomValue * (slider.max - slider.min);
    // Quantize to step size
    const steps = Math.round((raw - slider.min) / slider.step);
    newParams[key] = slider.min + steps * slider.step;
    modified = true;
  }

  return modified ? { ...options, params: newParams } : options;
}

/**
 * Compute the effective (seed-randomized) param values for display in the UI.
 * Creates a throwaway PRNG from the same seed to produce identical values
 * to what randomizeDefaults would compute inside generate().
 */
export function getEffectiveParams(
  seed: number,
  paramDefs: ParamDef[],
  createRandFn: (seed: number) => () => number,
): Record<string, number> {
  const rand = createRandFn(seed);

  const result: Record<string, number> = {};

  for (const def of paramDefs) {
    if (def.type !== 'slider') {
      result[def.key] = def.defaultValue;
      continue;
    }

    const slider = def as SliderParamDef;
    const randomValue = rand();
    const raw = slider.min + randomValue * (slider.max - slider.min);
    const steps = Math.round((raw - slider.min) / slider.step);
    result[def.key] = slider.min + steps * slider.step;
  }

  return result;
}
