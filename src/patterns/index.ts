import type { PatternGenerator } from '../core/types.js';
import { woodBlock } from './wood-block.js';
import { flowField } from './flow-field.js';
import { domainWarp } from './domain-warp.js';
import { topographic } from './topographic.js';
import { marble } from './marble.js';
import { waveInterference } from './wave-interference.js';

/**
 * Registry of all available pattern generators.
 * Each pattern is registered with a unique slug name used for CLI --type flag.
 */
export const patternRegistry: PatternGenerator[] = [
  woodBlock,
  flowField,
  domainWarp,
  topographic,
  marble,
  waveInterference,
];

/** Map of pattern name to generator for fast lookup */
export const patternsByName: Map<string, PatternGenerator> = new Map(
  patternRegistry.map((p) => [p.name, p]),
);

/** Get all pattern names */
export function getPatternNames(): string[] {
  return patternRegistry.map((p) => p.name);
}
