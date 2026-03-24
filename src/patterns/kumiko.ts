import type { ParamDef, PatternGenerator, PatternOptions } from '../core/types.js';
import { getParam } from '../core/param-utils.js';
import { shuffleArray } from '../core/array-utils.js';
import { randomizeDefaults } from '../core/randomize-defaults.js';

/**
 * Equilateral triangle grid — ported from kumiko-gen's grid.ts
 */
interface Point { x: number; y: number; }
interface Triangle {
  vertices: [Point, Point, Point];
  centroid: Point;
  isUpward: boolean;
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function lerp(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function generateGrid(size: number, divisions: number): Triangle[] {
  const triangles: Triangle[] = [];
  const colWidth = size / divisions;
  const rowHeight = colWidth * (Math.sqrt(3) / 2);
  const rows = Math.ceil(size / rowHeight) + 1;

  for (let row = 0; row < rows; row++) {
    const y = row * rowHeight;
    for (let col = 0; col < divisions; col++) {
      const x = col * colWidth;
      const upA: Point = { x, y: y + rowHeight };
      const upB: Point = { x: x + colWidth, y: y + rowHeight };
      const upC: Point = { x: x + colWidth / 2, y };
      const cen = { x: (upA.x + upB.x + upC.x) / 3, y: (upA.y + upB.y + upC.y) / 3 };
      triangles.push({ vertices: [upA, upB, upC], centroid: cen, isUpward: true });

      if (col < divisions - 1) {
        const downA: Point = { x: x + colWidth / 2, y };
        const downB: Point = { x: x + colWidth, y: y + rowHeight };
        const downC: Point = { x: x + colWidth * 1.5, y };
        const cenD = { x: (downA.x + downB.x + downC.x) / 3, y: (downA.y + downB.y + downC.y) / 3 };
        triangles.push({ vertices: [downA, downB, downC], centroid: cenD, isUpward: false });
      }
    }
  }
  return triangles;
}

/**
 * Kumiko sub-patterns — Canvas 2D versions of kumiko-gen's patterns
 */
type KumikoSubPattern = (ctx: CanvasRenderingContext2D, tri: Triangle, sw: number) => void;

function drawLine(ctx: CanvasRenderingContext2D, a: Point, b: Point, sw: number): void {
  ctx.lineWidth = sw;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawArc(ctx: CanvasRenderingContext2D, from: Point, to: Point, radius: number, sw: number): void {
  // Approximate SVG arc with a quadratic bezier
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const h = Math.sqrt(Math.max(0, radius * radius - (d / 2) ** 2));
  const cx = mx + (h * dy) / d;
  const cy = my - (h * dx) / d;

  ctx.lineWidth = sw;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(cx, cy, to.x, to.y);
  ctx.stroke();
}

// Asanoha: lines from each vertex to centroid
const asanoha: KumikoSubPattern = (ctx, tri, sw) => {
  const [a, b, c] = tri.vertices;
  drawLine(ctx, a, tri.centroid, sw);
  drawLine(ctx, b, tri.centroid, sw);
  drawLine(ctx, c, tri.centroid, sw);
};

// Mitsukude: lines from edge midpoints to centroid
const mitsukude: KumikoSubPattern = (ctx, tri, sw) => {
  const [a, b, c] = tri.vertices;
  drawLine(ctx, mid(a, b), tri.centroid, sw);
  drawLine(ctx, mid(b, c), tri.centroid, sw);
  drawLine(ctx, mid(c, a), tri.centroid, sw);
};

// Goma: lines from each vertex to opposite edge midpoint
const goma: KumikoSubPattern = (ctx, tri, sw) => {
  const [a, b, c] = tri.vertices;
  drawLine(ctx, a, mid(b, c), sw);
  drawLine(ctx, b, mid(c, a), sw);
  drawLine(ctx, c, mid(a, b), sw);
};

// Shippo: arcs between adjacent vertices
const shippo: KumikoSubPattern = (ctx, tri, sw) => {
  const [a, b, c] = tri.vertices;
  const radius = dist(a, b) * 0.5;
  drawArc(ctx, a, b, radius, sw);
  drawArc(ctx, b, c, radius, sw);
  drawArc(ctx, c, a, radius, sw);
};

// Kikko: inner triangle + vertex connections
const kikko: KumikoSubPattern = (ctx, tri, sw) => {
  const [a, b, c] = tri.vertices;
  const ia = lerp(tri.centroid, a, 0.4);
  const ib = lerp(tri.centroid, b, 0.4);
  const ic = lerp(tri.centroid, c, 0.4);
  drawLine(ctx, ia, ib, sw);
  drawLine(ctx, ib, ic, sw);
  drawLine(ctx, ic, ia, sw);
  drawLine(ctx, a, ia, sw);
  drawLine(ctx, b, ib, sw);
  drawLine(ctx, c, ic, sw);
};

// Yae-asanoha: 6-spoke star (vertex + midpoint radials)
const yaeAsanoha: KumikoSubPattern = (ctx, tri, sw) => {
  const [a, b, c] = tri.vertices;
  const cen = tri.centroid;
  drawLine(ctx, a, cen, sw);
  drawLine(ctx, b, cen, sw);
  drawLine(ctx, c, cen, sw);
  drawLine(ctx, mid(a, b), cen, sw);
  drawLine(ctx, mid(b, c), cen, sw);
  drawLine(ctx, mid(c, a), cen, sw);
};

const KUMIKO_SUB_PATTERNS: { name: string; fn: KumikoSubPattern }[] = [
  { name: 'asanoha', fn: asanoha },
  { name: 'mitsukude', fn: mitsukude },
  { name: 'goma', fn: goma },
  { name: 'shippo', fn: shippo },
  { name: 'kikko', fn: kikko },
  { name: 'yae-asanoha', fn: yaeAsanoha },
];

const paramDefs: ParamDef[] = [
  { type: 'slider', key: 'divisions', label: 'Grid Divisions', min: 4, max: 16, step: 1, defaultValue: 8 },
  { type: 'slider', key: 'layerCount', label: 'Layer Count', min: 1, max: 4, step: 1, defaultValue: 3 },
  { type: 'slider', key: 'strokeWidth', label: 'Stroke Width', min: 0.5, max: 5, step: 0.25, defaultValue: 2 },
  { type: 'slider', key: 'overlapCount', label: 'Overlap Copies', min: 1, max: 3, step: 1, defaultValue: 1 },
];

/**
 * Kumiko pattern — Japanese kumiko geometric woodwork.
 * Multiple sub-patterns (asanoha, mitsukude, goma, shippo, kikko, yae-asanoha)
 * overlaid on an equilateral triangle grid with rotation and translation.
 * Ported from kumiko-gen to Canvas 2D.
 */
export const kumiko: PatternGenerator = {
  name: 'kumiko',
  displayName: 'Kumiko',
  description: 'Japanese kumiko geometric woodwork — layered triangle grid patterns',
  paramDefs,

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;
    options = randomizeDefaults(options, paramDefs, rand);

    const bg = colorScheme.palette[0];
    const fgColors = shuffleArray(colorScheme.palette.slice(1), rand);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const divisions = getParam(options, paramDefs, 'divisions') / zoom;
    const layerCount = Math.round(getParam(options, paramDefs, 'layerCount'));
    const strokeWidth = getParam(options, paramDefs, 'strokeWidth') / zoom;
    const overlapCount = Math.round(getParam(options, paramDefs, 'overlapCount'));

    const canvasSize = Math.max(width, height) * 1.5; // overflow for rotation
    const triangles = generateGrid(canvasSize, divisions);

    // Pick distinct sub-patterns
    const shuffled = shuffleArray(KUMIKO_SUB_PATTERNS, rand);
    const layers = shuffled.slice(0, layerCount);

    // Pick colors per layer
    const layerColors = layers.map(() => fgColors[Math.floor(rand() * fgColors.length)]);

    const cx = canvasSize / 2;
    const cy = canvasSize / 2;
    const offsetX = (width - canvasSize) / 2;
    const offsetY = (height - canvasSize) / 2;

    ctx.lineCap = 'square';
    ctx.lineJoin = 'bevel';

    for (let li = 0; li < layers.length; li++) {
      const pattern = layers[li];
      const color = layerColors[li];
      const layerAngle = rand() * 360;
      const layerDx = (rand() - 0.5) * width * 0.4;
      const layerDy = (rand() - 0.5) * height * 0.4;

      for (let oi = 0; oi < overlapCount; oi++) {
        const overlapDx = oi === 0 ? 0 : (rand() - 0.5) * canvasSize * 0.03;
        const overlapDy = oi === 0 ? 0 : (rand() - 0.5) * canvasSize * 0.03;
        const overlapAngle = oi === 0 ? 0 : (rand() - 0.5) * 8;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.translate(layerDx + overlapDx, layerDy + overlapDy);
        ctx.translate(cx, cy);
        ctx.rotate(((layerAngle + overlapAngle) * Math.PI) / 180);
        ctx.translate(-cx, -cy);

        ctx.strokeStyle = color;
        for (const tri of triangles) {
          pattern.fn(ctx, tri, strokeWidth);
        }

        ctx.restore();
      }
    }
  },
};
