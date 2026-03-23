import type { PatternGenerator } from '../core/types.js';
import { woodBlock } from './wood-block.js';
import { islamicStar } from './islamic-star.js';
import { sashiko } from './sashiko.js';
import { celticKnot } from './celtic-knot.js';
import { meander } from './meander.js';
import { zellige } from './zellige.js';

/**
 * Registry of all available pattern generators.
 * Each pattern is registered with a unique slug name used for CLI --type flag.
 */
export const patternRegistry: PatternGenerator[] = [
  woodBlock,
  islamicStar,
  sashiko,
  celticKnot,
  meander,
  zellige,
];

/** Map of pattern name to generator for fast lookup */
export const patternsByName: Map<string, PatternGenerator> = new Map(
  patternRegistry.map((p) => [p.name, p]),
);

/** Get all pattern names */
export function getPatternNames(): string[] {
  return patternRegistry.map((p) => p.name);
}
