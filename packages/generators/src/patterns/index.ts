import type { PatternGenerator } from '@takazudo/pattern-gen-core';
import { solidColor } from './solid-color.js';
import { gradient } from './gradient.js';
import { glass } from './glass.js';
import { texture } from './texture.js';
import { kumiko } from './kumiko.js';
import { woodBlock } from './wood-block.js';
import { truchet } from './truchet.js';
import { herringbone } from './herringbone.js';
import { isometric } from './isometric.js';
import { penrose } from './penrose.js';
import { patchwork } from './patchwork.js';
import { flowField } from './flow-field.js';
import { domainWarp } from './domain-warp.js';
import { topographic } from './topographic.js';
import { marble } from './marble.js';
import { waveInterference } from './wave-interference.js';
import { voronoi } from './voronoi.js';
import { worley } from './worley.js';
import { crystal } from './crystal.js';
import { stipple } from './stipple.js';
import { islamicStar } from './islamic-star.js';
import { sashiko } from './sashiko.js';
import { celticKnot } from './celtic-knot.js';
import { meander } from './meander.js';
import { zellige } from './zellige.js';
import { tartan } from './tartan.js';
import { houndstooth } from './houndstooth.js';
import { chevron } from './chevron.js';
import { ikat } from './ikat.js';
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
  // Simple
  solidColor,
  gradient,
  glass,
  texture,
  // Kumiko (Japanese woodwork)
  kumiko,
  // Grid & Tile
  woodBlock,
  truchet,
  herringbone,
  isometric,
  penrose,
  patchwork,
  // Noise & Flow
  flowField,
  domainWarp,
  topographic,
  marble,
  waveInterference,
  // Voronoi & Cell
  voronoi,
  worley,
  crystal,
  stipple,
  // Traditional
  islamicStar,
  sashiko,
  celticKnot,
  meander,
  zellige,
  // Textile
  tartan,
  houndstooth,
  chevron,
  ikat,
  // Math & Digital
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
