import type { FrameGenerator } from '../core/frame-types.js';

// Import all 20 frames
import { simpleLine } from './simple-line.js';
import { roundedCorner } from './rounded-corner.js';
import { gradientBorder } from './gradient-border.js';
import { dropShadow } from './drop-shadow.js';
import { doubleLine } from './double-line.js';
import { artDeco } from './art-deco.js';
import { greekKey } from './greek-key.js';
import { dotted } from './dotted.js';
import { scalloped } from './scalloped.js';
import { filmstrip } from './filmstrip.js';
import { polaroid } from './polaroid.js';
import { tornEdge } from './torn-edge.js';
import { neonGlow } from './neon-glow.js';
import { washiTape } from './washi-tape.js';
import { cornerOrnament } from './corner-ornament.js';
import { zigzag } from './zigzag.js';
import { halftone } from './halftone.js';
import { vignette } from './vignette.js';
import { stamp } from './stamp.js';
import { brushStroke } from './brush-stroke.js';

/** All registered frame generators */
export const FRAME_GENERATORS: FrameGenerator[] = [
  simpleLine,
  roundedCorner,
  gradientBorder,
  dropShadow,
  doubleLine,
  artDeco,
  greekKey,
  dotted,
  scalloped,
  filmstrip,
  polaroid,
  tornEdge,
  neonGlow,
  washiTape,
  cornerOrnament,
  zigzag,
  halftone,
  vignette,
  stamp,
  brushStroke,
];

/** Look up a frame by name */
export const framesByName = new Map<string, FrameGenerator>(
  FRAME_GENERATORS.map((f) => [f.name, f]),
);
