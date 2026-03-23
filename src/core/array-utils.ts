/**
 * Shared array utilities for pattern generators.
 */

/** Fisher-Yates shuffle using a seeded PRNG. Returns a new shuffled copy. */
export function shuffleArray<T>(arr: readonly T[], rand: () => number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
