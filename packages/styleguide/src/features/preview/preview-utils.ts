/** Convert camelCase key to human-readable label */
export function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').trim();
}
