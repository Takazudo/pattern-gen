/**
 * Type-safe frame parameter extraction with optional clamping.
 */
export function getFrameParam(params: Record<string, number | string>, key: string, defaultValue: number): number;
export function getFrameParam(params: Record<string, number | string>, key: string, defaultValue: string): string;
export function getFrameParam(
  params: Record<string, number | string>,
  key: string,
  defaultValue: string | number,
): string | number {
  const raw = params[key];
  if (raw === undefined || raw === null) return defaultValue;

  // Type-check: ensure the raw value matches the expected type
  if (typeof raw !== typeof defaultValue) return defaultValue;

  // Guard against NaN (typeof NaN === 'number' but it's not a valid param value)
  if (typeof raw === 'number' && isNaN(raw)) return defaultValue;

  return raw;
}

/**
 * Get a numeric frame parameter with min/max clamping.
 */
export function getFrameParamClamped(
  params: Record<string, number | string>,
  key: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const value = getFrameParam(params, key, defaultValue);
  return Math.max(min, Math.min(max, value));
}
