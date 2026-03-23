import type { PatternGenerator } from '../core/types.js';
import { woodBlock } from './wood-block.js';
import { truchet } from './truchet.js';
import { herringbone } from './herringbone.js';
import { isometric } from './isometric.js';
import { penrose } from './penrose.js';
import { patchwork } from './patchwork.js';

/**
 * Registry of all available pattern generators.
 * Each pattern is registered with a unique slug name used for CLI --type flag.
 */
export const patternRegistry: PatternGenerator[] = [
  woodBlock,
  truchet,
  herringbone,
  isometric,
  penrose,
  patchwork,
];

/** Map of pattern name to generator for fast lookup */
export const patternsByName: Map<string, PatternGenerator> = new Map(
  patternRegistry.map((p) => [p.name, p]),
);

/** Get all pattern names */
export function getPatternNames(): string[] {
  return patternRegistry.map((p) => p.name);
}
