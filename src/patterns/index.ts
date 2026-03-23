import type { PatternGenerator } from '../core/types.js';
import { woodBlock } from './wood-block.js';
import { voronoi } from './voronoi.js';
import { worley } from './worley.js';
import { crystal } from './crystal.js';
import { stipple } from './stipple.js';

/**
 * Registry of all available pattern generators.
 * Each pattern is registered with a unique slug name used for CLI --type flag.
 */
export const patternRegistry: PatternGenerator[] = [
  woodBlock,
  voronoi,
  worley,
  crystal,
  stipple,
];

/** Map of pattern name to generator for fast lookup */
export const patternsByName: Map<string, PatternGenerator> = new Map(
  patternRegistry.map((p) => [p.name, p]),
);

/** Get all pattern names */
export function getPatternNames(): string[] {
  return patternRegistry.map((p) => p.name);
}
