import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { withAlpha, darken, lighten } from '../core/color-utils.js';

const paramDefs: ParamDef[] = [
  {
    key: 'unitSize',
    label: 'Unit Size',
    type: 'slider',
    min: 10,
    max: 80,
    step: 1,
    defaultValue: 40,
  },
  {
    key: 'lineWidth',
    label: 'Line Width',
    type: 'slider',
    min: 1,
    max: 10,
    step: 0.5,
    defaultValue: 4,
  },
  {
    key: 'frameCount',
    label: 'Frame Count',
    type: 'slider',
    min: 1,
    max: 5,
    step: 1,
    defaultValue: 2,
  },
  {
    key: 'style',
    label: 'Border Style',
    type: 'select',
    options: [
      { value: 0, label: 'Classic' },
      { value: 1, label: 'Running' },
      { value: 2, label: 'Wave' },
      { value: 3, label: 'Labyrinth' },
    ],
    defaultValue: 0,
  },
  {
    key: 'fillStyle',
    label: 'Fill Style',
    type: 'select',
    options: [
      { value: 0, label: 'Key Tiles' },
      { value: 1, label: 'Zigzag' },
      { value: 2, label: 'Spiral' },
      { value: 3, label: 'Empty' },
    ],
    defaultValue: 0,
  },
  {
    key: 'keyComplexity',
    label: 'Key Complexity',
    type: 'slider',
    min: 1,
    max: 5,
    step: 1,
    defaultValue: 2,
  },
  {
    key: 'borderDecoration',
    label: 'Border Decoration',
    type: 'toggle',
    defaultValue: 0,
  },
];

/**
 * Meander pattern — Greek key / meander with nested rectangular spirals.
 * Arranged as repeating tiles that connect seamlessly. Supports nested
 * concentric frames with multiple border styles and interior fill modes.
 */
export const meander: PatternGenerator = {
  name: 'meander',
  displayName: 'Meander',
  description: 'Greek key meander with nested rectangular spirals in concentric frames',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Pick main key color and accent
    const keyColor = fgColors[Math.floor(rand() * fgColors.length)];
    const accentColor = fgColors[Math.floor(rand() * fgColors.length)];

    // Tile sizing
    const unitSizeDivisor = getParam(options, paramDefs, 'unitSize');
    const baseUnit = Math.max(width, height) / unitSizeDivisor;
    const unit = baseUnit / zoom;
    const lineWidth = Math.max(2, getParam(options, paramDefs, 'lineWidth'));

    // Params
    const numFrames = getParam(options, paramDefs, 'frameCount');
    const style = getParam(options, paramDefs, 'style');
    const fillStyle = getParam(options, paramDefs, 'fillStyle');
    const keyComplexity = getParam(options, paramDefs, 'keyComplexity');
    const borderDecoration = getParam(options, paramDefs, 'borderDecoration');
    const frameSpacing = unit * 5;

    // Collect corner positions for decoration
    const cornerPoints: { x: number; y: number }[] = [];

    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    for (let frame = 0; frame < numFrames; frame++) {
      const inset = frame * frameSpacing;
      const fx = inset;
      const fy = inset;
      const fw = width - inset * 2;
      const fh = height - inset * 2;

      if (fw <= unit * 6 || fh <= unit * 6) break;

      const currentColor = frame % 2 === 0 ? keyColor : accentColor;
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = lineWidth;

      // Draw frame border
      ctx.strokeRect(fx + lineWidth / 2, fy + lineWidth / 2, fw - lineWidth, fh - lineWidth);

      // Collect frame corners for decoration
      if (borderDecoration === 1) {
        cornerPoints.push(
          { x: fx + unit * 3, y: fy + unit * 3 },
          { x: fx + fw - unit * 3, y: fy + unit * 3 },
          { x: fx + unit * 3, y: fy + fh - unit * 3 },
          { x: fx + fw - unit * 3, y: fy + fh - unit * 3 },
        );
      }

      // Draw border pattern along each side based on style
      const drawBorderFn = getBorderDrawFn(style);
      // Top border
      drawBorderFn(ctx, fx + unit * 3, fy + unit, fw - unit * 6, unit * 3, 'horizontal', currentColor, lineWidth, keyComplexity, rand, cornerPoints);
      // Bottom border
      drawBorderFn(ctx, fx + unit * 3, fy + fh - unit * 4, fw - unit * 6, unit * 3, 'horizontal', currentColor, lineWidth, keyComplexity, rand, cornerPoints);
      // Left border
      drawBorderFn(ctx, fx + unit, fy + unit * 3, fh - unit * 6, unit * 3, 'vertical', currentColor, lineWidth, keyComplexity, rand, cornerPoints);
      // Right border
      drawBorderFn(ctx, fx + fw - unit * 4, fy + unit * 3, fh - unit * 6, unit * 3, 'vertical', currentColor, lineWidth, keyComplexity, rand, cornerPoints);
    }

    // Fill the interior based on fillStyle
    const interiorInset = numFrames * frameSpacing + unit;
    const startX = interiorInset;
    const startY = interiorInset;
    const endX = width - interiorInset;
    const endY = height - interiorInset;

    if (fillStyle !== 3 && endX > startX && endY > startY) {
      ctx.strokeStyle = withAlpha(keyColor, 0.6);
      ctx.lineWidth = Math.max(1.5, lineWidth * 0.7);

      switch (fillStyle) {
        case 0:
          drawKeyTilesFill(ctx, startX, startY, endX, endY, unit);
          break;
        case 1:
          drawZigzagFill(ctx, startX, startY, endX, endY, unit, rand);
          break;
        case 2:
          drawSpiralFill(ctx, startX, startY, endX, endY, unit, rand);
          break;
      }
    }

    // Border decoration: dots at key corners (cap at 200 to prevent perf issues)
    if (borderDecoration === 1 && cornerPoints.length > 0) {
      const dotColor = withAlpha(accentColor, 0.7);
      const dotRadius = Math.max(2, lineWidth * 0.8);
      ctx.fillStyle = dotColor;
      const cappedPoints = cornerPoints.length > 200 ? cornerPoints.slice(0, 200) : cornerPoints;
      for (const pt of cappedPoints) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle shadow effect on outer frame
    if (numFrames > 0) {
      ctx.strokeStyle = withAlpha(darken(keyColor, 0.4), 0.15);
      ctx.lineWidth = lineWidth + 2;
      ctx.strokeRect(2, 2, width - 4, height - 4);
    }
  },
};

// ---------------------------------------------------------------------------
// Border draw function dispatcher
// ---------------------------------------------------------------------------

type BorderDrawFn = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  bandHeight: number,
  direction: 'horizontal' | 'vertical',
  color: string,
  lineWidth: number,
  complexity: number,
  rand: () => number,
  corners: { x: number; y: number }[],
) => void;

function getBorderDrawFn(style: number): BorderDrawFn {
  switch (style) {
    case 1: return drawRunningBorder;
    case 2: return drawWaveBorder;
    case 3: return drawLabyrinthBorder;
    default: return drawClassicBorder;
  }
}

// ---------------------------------------------------------------------------
// Style 0: Classic Greek key (original behavior)
// ---------------------------------------------------------------------------

function drawClassicBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  bandHeight: number,
  direction: 'horizontal' | 'vertical',
  color: string,
  lineWidth: number,
  complexity: number,
  _rand: () => number,
  corners: { x: number; y: number }[],
): void {
  if (length <= 0) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const step = bandHeight;
  const numKeys = Math.floor(length / step);
  if (numKeys <= 0) return;

  for (let i = 0; i < numKeys; i++) {
    const isEven = i % 2 === 0;

    if (direction === 'horizontal') {
      const kx = x + i * step;
      const ky = y;
      drawSingleKey(ctx, kx, ky, step, bandHeight, isEven, complexity, corners);
    } else {
      const kx = x;
      const ky = y + i * step;
      drawSingleKeyVertical(ctx, kx, ky, bandHeight, step, isEven, complexity, corners);
    }
  }
}

// ---------------------------------------------------------------------------
// Style 1: Running spiral border
// ---------------------------------------------------------------------------

function drawRunningBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  bandHeight: number,
  direction: 'horizontal' | 'vertical',
  color: string,
  lineWidth: number,
  complexity: number,
  _rand: () => number,
  corners: { x: number; y: number }[],
): void {
  if (length <= 0) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const step = bandHeight;
  const numSpirals = Math.floor(length / step);
  if (numSpirals <= 0) return;

  // Draw independent running spirals — each unit gets its own stroke
  const turns = Math.min(complexity, 4);

  for (let i = 0; i < numSpirals; i++) {
    ctx.beginPath();

    if (direction === 'horizontal') {
      const sx = x + i * step;
      const sy = y;
      drawRunningSpiral(ctx, sx, sy, step, bandHeight, turns, corners);
    } else {
      const sx = x;
      const sy = y + i * step;
      drawRunningSpiral(ctx, sx, sy, bandHeight, step, turns, corners);
    }

    ctx.stroke();
  }
}

function drawRunningSpiral(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  turns: number,
  corners: { x: number; y: number }[],
): void {
  // Rectangular spiral that winds inward — each call starts its own sub-path
  const insetStep = Math.min(w, h) / (turns * 2 + 1);

  ctx.moveTo(x, y + h / 2);

  let cx = x;
  let cy = y;
  let cw = w;
  let ch = h;

  for (let t = 0; t < turns; t++) {
    // Wind around clockwise
    ctx.lineTo(cx + cw, cy);
    ctx.lineTo(cx + cw, cy + ch);
    ctx.lineTo(cx + insetStep, cy + ch);
    ctx.lineTo(cx + insetStep, cy + insetStep);

    if (corners.length < 200) corners.push({ x: cx + cw, y: cy });
    if (corners.length < 200) corners.push({ x: cx + cw, y: cy + ch });

    cx += insetStep;
    cy += insetStep;
    cw -= insetStep * 2;
    ch -= insetStep * 2;

    if (cw <= insetStep || ch <= insetStep) break;
  }
}

// ---------------------------------------------------------------------------
// Style 2: Wave / S-curve border
// ---------------------------------------------------------------------------

function drawWaveBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  bandHeight: number,
  direction: 'horizontal' | 'vertical',
  color: string,
  lineWidth: number,
  complexity: number,
  _rand: () => number,
  corners: { x: number; y: number }[],
): void {
  if (length <= 0) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const amplitude = bandHeight * 0.4;
  const wavelength = bandHeight * (1.5 / Math.max(1, complexity * 0.5));
  const numWaves = Math.floor(length / wavelength);
  if (numWaves <= 0) return;

  // Draw multiple wave lines stacked for complexity
  for (let layer = 0; layer < Math.min(complexity, 4); layer++) {
    const offset = (bandHeight / (complexity + 1)) * (layer + 1);
    const layerAmplitude = amplitude * (1 - layer * 0.15);

    ctx.beginPath();

    for (let i = 0; i <= numWaves * 10; i++) {
      const t = i / 10;
      const progress = (t / numWaves) * length;

      if (progress > length) break;

      const wave = Math.sin((t / numWaves) * Math.PI * 2 * numWaves) * layerAmplitude;

      let px: number;
      let py: number;

      if (direction === 'horizontal') {
        px = x + progress;
        py = y + offset + wave;
      } else {
        px = x + offset + wave;
        py = y + progress;
      }

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }

      // Add corner points at wave peaks for decoration
      if (corners.length < 200 && Math.abs(wave) > layerAmplitude * 0.95) {
        corners.push({ x: px, y: py });
      }
    }

    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Style 3: Labyrinth border
// ---------------------------------------------------------------------------

function drawLabyrinthBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  bandHeight: number,
  direction: 'horizontal' | 'vertical',
  color: string,
  lineWidth: number,
  complexity: number,
  rand: () => number,
  corners: { x: number; y: number }[],
): void {
  if (length <= 0) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const cellSize = bandHeight / Math.max(2, complexity + 1);
  const cols = direction === 'horizontal'
    ? Math.floor(length / cellSize)
    : Math.floor(bandHeight / cellSize);
  const rows = direction === 'horizontal'
    ? Math.floor(bandHeight / cellSize)
    : Math.floor(length / cellSize);

  if (cols <= 0 || rows <= 0) return;

  // Generate a simple maze using randomized walls
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let cx: number;
      let cy: number;

      if (direction === 'horizontal') {
        cx = x + col * cellSize;
        cy = y + row * cellSize;
      } else {
        cx = x + row * cellSize;
        cy = y + col * cellSize;
      }

      // Randomly draw walls — more walls with higher complexity
      const wallChance = 0.3 + complexity * 0.1;

      // Right wall
      if (rand() < wallChance && col < cols - 1) {
        ctx.beginPath();
        ctx.moveTo(cx + cellSize, cy);
        ctx.lineTo(cx + cellSize, cy + cellSize);
        ctx.stroke();
      }

      // Bottom wall
      if (rand() < wallChance && row < rows - 1) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + cellSize);
        ctx.lineTo(cx + cellSize, cy + cellSize);
        ctx.stroke();
      }

      // Dead ends — short stubs at random positions
      if (rand() < 0.15) {
        const stubLen = cellSize * 0.4;
        const mx = cx + cellSize / 2;
        const my = cy + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + stubLen * (rand() - 0.5) * 2, my + stubLen * (rand() - 0.5) * 2);
        ctx.stroke();

        if (corners.length < 200) corners.push({ x: mx, y: my });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Single key drawing (classic) with complexity support
// ---------------------------------------------------------------------------

/** Draw a single Greek key motif (horizontal) with variable complexity */
function drawSingleKey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flipped: boolean,
  complexity: number,
  corners: { x: number; y: number }[],
): void {
  const turns = Math.max(1, Math.min(complexity, 5));
  const insetStep = Math.min(w, h) / (turns * 2 + 1);

  ctx.beginPath();

  if (turns <= 2) {
    // Original simple key behavior for low complexity (backward compatible at default=2)
    const inset = w * 0.25;
    if (flipped) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + inset, y + h);
      ctx.lineTo(x + inset, y + inset);
      ctx.lineTo(x + w - inset, y + inset);
      ctx.lineTo(x + w - inset, y + h - inset);
      ctx.lineTo(x, y + h - inset);
    } else {
      ctx.moveTo(x + w, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w - inset, y + h);
      ctx.lineTo(x + w - inset, y + inset);
      ctx.lineTo(x + inset, y + inset);
      ctx.lineTo(x + inset, y + h - inset);
      ctx.lineTo(x + w, y + h - inset);
    }

    // Corner decoration points
    corners.push({ x: x + w / 2, y: y + h / 2 });
  } else {
    // Complex multi-turn key
    if (flipped) {
      ctx.moveTo(x, y);
      let cx = x;
      let cy = y;
      let cw = w;
      let ch = h;

      for (let t = 0; t < turns; t++) {
        if (t % 2 === 0) {
          ctx.lineTo(cx + cw, cy);
          ctx.lineTo(cx + cw, cy + ch);
          corners.push({ x: cx + cw, y: cy });
        } else {
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + ch);
          corners.push({ x: cx, y: cy });
        }
        cx += insetStep;
        cy += insetStep;
        cw -= insetStep * 2;
        ch -= insetStep * 2;
        if (cw <= insetStep || ch <= insetStep) break;
      }
    } else {
      ctx.moveTo(x + w, y);
      let cx = x;
      let cy = y;
      let cw = w;
      let ch = h;

      for (let t = 0; t < turns; t++) {
        if (t % 2 === 0) {
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + ch);
          corners.push({ x: cx, y: cy + ch });
        } else {
          ctx.lineTo(cx + cw, cy);
          ctx.lineTo(cx + cw, cy + ch);
          corners.push({ x: cx + cw, y: cy + ch });
        }
        cx += insetStep;
        cy += insetStep;
        cw -= insetStep * 2;
        ch -= insetStep * 2;
        if (cw <= insetStep || ch <= insetStep) break;
      }
    }
  }

  ctx.stroke();
}

/** Draw a single Greek key motif (vertical) with variable complexity */
function drawSingleKeyVertical(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flipped: boolean,
  complexity: number,
  corners: { x: number; y: number }[],
): void {
  const turns = Math.max(1, Math.min(complexity, 5));
  const insetStep = Math.min(w, h) / (turns * 2 + 1);

  ctx.beginPath();

  if (turns <= 2) {
    // Original simple key behavior
    const inset = h * 0.25;
    if (flipped) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + inset);
      ctx.lineTo(x + inset, y + inset);
      ctx.lineTo(x + inset, y + h - inset);
      ctx.lineTo(x + w - inset, y + h - inset);
      ctx.lineTo(x + w - inset, y);
    } else {
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - inset);
      ctx.lineTo(x + inset, y + h - inset);
      ctx.lineTo(x + inset, y + inset);
      ctx.lineTo(x + w - inset, y + inset);
      ctx.lineTo(x + w - inset, y + h);
    }

    corners.push({ x: x + w / 2, y: y + h / 2 });
  } else {
    // Complex multi-turn key (vertical)
    if (flipped) {
      ctx.moveTo(x, y);
      let cx = x;
      let cy = y;
      let cw = w;
      let ch = h;

      for (let t = 0; t < turns; t++) {
        if (t % 2 === 0) {
          ctx.lineTo(cx, cy + ch);
          ctx.lineTo(cx + cw, cy + ch);
          corners.push({ x: cx, y: cy + ch });
        } else {
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + cw, cy);
          corners.push({ x: cx + cw, y: cy });
        }
        cx += insetStep;
        cy += insetStep;
        cw -= insetStep * 2;
        ch -= insetStep * 2;
        if (cw <= insetStep || ch <= insetStep) break;
      }
    } else {
      ctx.moveTo(x, y + h);
      let cx = x;
      let cy = y;
      let cw = w;
      let ch = h;

      for (let t = 0; t < turns; t++) {
        if (t % 2 === 0) {
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + cw, cy);
          corners.push({ x: cx + cw, y: cy });
        } else {
          ctx.lineTo(cx, cy + ch);
          ctx.lineTo(cx + cw, cy + ch);
          corners.push({ x: cx + cw, y: cy + ch });
        }
        cx += insetStep;
        cy += insetStep;
        cw -= insetStep * 2;
        ch -= insetStep * 2;
        if (cw <= insetStep || ch <= insetStep) break;
      }
    }
  }

  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Interior fill functions
// ---------------------------------------------------------------------------

/** Fill style 0: Greek key tiles (original) */
function drawKeyTilesFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  unit: number,
): void {
  const tileSize = unit * 4;
  for (let y = startY; y < endY; y += tileSize) {
    for (let x = startX; x < endX; x += tileSize) {
      drawGreekKeyTile(ctx, x, y, tileSize, unit);
    }
  }
}

/** Fill style 1: Zigzag pattern */
function drawZigzagFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  unit: number,
  rand: () => number,
): void {
  const zigWidth = unit * 2;
  const zigHeight = unit * 1.5;
  const rows = Math.ceil((endY - startY) / zigHeight);

  for (let row = 0; row < rows; row++) {
    const y = startY + row * zigHeight;
    const offset = (row % 2 === 0 ? 0 : zigWidth / 2) + rand() * unit * 0.2;

    ctx.beginPath();
    ctx.moveTo(startX, y);

    let x = startX + offset;
    let up = true;

    while (x < endX) {
      const zy = up ? y : y + zigHeight;
      ctx.lineTo(x, zy);
      x += zigWidth / 2;
      up = !up;
    }

    ctx.stroke();
  }
}

/** Fill style 2: Archimedean spiral fill */
function drawSpiralFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  unit: number,
  rand: () => number,
): void {
  const centerX = (startX + endX) / 2;
  const centerY = (startY + endY) / 2;
  const maxRadius = Math.min(endX - startX, endY - startY) / 2;
  const spacing = unit * (0.8 + rand() * 0.4);
  const totalTurns = maxRadius / spacing;
  const steps = Math.floor(totalTurns * 60);

  if (steps <= 0) return;

  ctx.beginPath();
  let drawing = false;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * totalTurns * Math.PI * 2;
    const r = (i / steps) * maxRadius;
    const px = centerX + Math.cos(angle) * r;
    const py = centerY + Math.sin(angle) * r;

    if (px < startX || px > endX || py < startY || py > endY) {
      drawing = false;
      continue;
    }

    if (!drawing) {
      ctx.moveTo(px, py);
      drawing = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Greek key tile (original interior tile)
// ---------------------------------------------------------------------------

/** Draw a single repeating Greek key tile for the interior fill */
function drawGreekKeyTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  unit: number,
): void {
  const s = size;
  const u = unit * 0.8;

  // Spiral inward
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s, y + s);
  ctx.lineTo(x + u, y + s);
  ctx.lineTo(x + u, y + u);
  ctx.lineTo(x + s - u, y + u);
  ctx.lineTo(x + s - u, y + s - u);
  ctx.lineTo(x + u * 2, y + s - u);
  ctx.stroke();
}
