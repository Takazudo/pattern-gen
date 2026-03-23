import type { PatternGenerator } from '../core/types.js';
import { woodBlock } from './wood-block.js';
import { reactionDiffusion } from './reaction-diffusion.js';
import { phyllotaxis } from './phyllotaxis.js';
import { moire } from './moire.js';
import { opArt } from './op-art.js';
import { halftone } from './halftone.js';
import { guilloche } from './guilloche.js';

/**
 * Registry of all available pattern generators.
 * Each pattern is registered with a unique slug name used for CLI --type flag.
 */
export const patternRegistry: PatternGenerator[] = [
  woodBlock,
  reactionDiffusion,
  phyllotaxis,
  moire,
  opArt,
  halftone,
  guilloche,
];

/** Map of pattern name to generator for fast lookup */
export const patternsByName: Map<string, PatternGenerator> = new Map(
  patternRegistry.map((p) => [p.name, p]),
);

/** Get all pattern names */
export function getPatternNames(): string[] {
  return patternRegistry.map((p) => p.name);
}
