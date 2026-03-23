import type { PatternGenerator, PatternOptions } from '../core/types.js';
import { darken, lighten, lerpColor } from '../core/color-utils.js';

/**
 * Penrose P3 tiling — Kites and darts created via recursive subdivision
 * of a decagon of triangles. Produces an aperiodic tiling with 5-fold symmetry.
 */
export const penrose: PatternGenerator = {
  name: 'penrose',
  displayName: 'Penrose',
  description: 'Aperiodic Penrose P3 tiling with kites and darts',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, rand, colorScheme, zoom } = options;

    const bg = colorScheme.palette[0];
    const fgColors = colorScheme.palette.slice(1);

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Golden ratio
    const phi = (1 + Math.sqrt(5)) / 2;

    // Pick colors for kites and darts
    const kiteColor1 = fgColors[0];
    const kiteColor2 = fgColors[1 % fgColors.length];
    const dartColor1 = fgColors[2 % fgColors.length];
    const dartColor2 = fgColors[3 % fgColors.length];

    // Triangle types for Robinson decomposition
    // Type 0 = "thin" (dart half), Type 1 = "thick" (kite half)
    interface Triangle {
      type: number;
      a: [number, number];
      b: [number, number];
      c: [number, number];
    }

    // Start with a decagon of triangles centered on canvas
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = (Math.max(width, height) * 0.7) / zoom;

    let triangles: Triangle[] = [];

    // Create initial decagon of "thick" triangles
    for (let i = 0; i < 10; i++) {
      const angle1 = (2 * Math.PI * i) / 10 - Math.PI / 2;
      const angle2 = (2 * Math.PI * (i + 1)) / 10 - Math.PI / 2;

      const b: [number, number] = [
        centerX + radius * Math.cos(angle1),
        centerY + radius * Math.sin(angle1),
      ];
      const c: [number, number] = [
        centerX + radius * Math.cos(angle2),
        centerY + radius * Math.sin(angle2),
      ];

      if (i % 2 === 0) {
        triangles.push({ type: 1, a: [centerX, centerY], b, c });
      } else {
        triangles.push({ type: 1, a: [centerX, centerY], b: c, c: b });
      }
    }

    // Subdivide 5 times for detail
    const subdivisions = 5;
    for (let s = 0; s < subdivisions; s++) {
      const newTriangles: Triangle[] = [];

      for (const tri of triangles) {
        const { type, a, b, c } = tri;

        if (type === 1) {
          // Subdivide thick triangle (kite half)
          const p: [number, number] = [
            a[0] + (b[0] - a[0]) / phi,
            a[1] + (b[1] - a[1]) / phi,
          ];
          newTriangles.push({ type: 1, a: c, b: p, c: a });
          newTriangles.push({ type: 0, a: p, b: c, c: b });
        } else {
          // Subdivide thin triangle (dart half)
          const q: [number, number] = [
            b[0] + (a[0] - b[0]) / phi,
            b[1] + (a[1] - b[1]) / phi,
          ];
          newTriangles.push({ type: 0, a: q, b: a, c: c });
          const r: [number, number] = [
            b[0] + (c[0] - b[0]) / phi,
            b[1] + (c[1] - b[1]) / phi,
          ];
          newTriangles.push({ type: 1, a: r, b: q, c: c });
          newTriangles.push({ type: 0, a: r, b: b, c: q });
        }
      }

      triangles = newTriangles;
    }

    // Draw all triangles
    for (const tri of triangles) {
      const { type, a, b, c } = tri;

      // Color based on type (consume rand() for ALL triangles for determinism across zoom/size)
      let fillColor: string;
      if (type === 1) {
        // Kite half — interpolate between two kite colors based on position
        const t = ((a[0] + b[0] + c[0]) / 3 / width + (a[1] + b[1] + c[1]) / 3 / height) / 2;
        fillColor = lerpColor(kiteColor1, kiteColor2, Math.max(0, Math.min(1, t)));
      } else {
        // Dart half
        const t = ((a[0] + b[0] + c[0]) / 3 / width + (a[1] + b[1] + c[1]) / 3 / height) / 2;
        fillColor = lerpColor(dartColor1, dartColor2, Math.max(0, Math.min(1, t)));
      }

      // Add slight random variation (call rand() before the visibility cull for determinism)
      const variation = rand() * 0.08;
      fillColor = rand() < 0.5 ? darken(fillColor, 1 - variation) : lighten(fillColor, variation);

      // Skip triangles fully outside canvas
      const minX = Math.min(a[0], b[0], c[0]);
      const maxX = Math.max(a[0], b[0], c[0]);
      const minY = Math.min(a[1], b[1], c[1]);
      const maxY = Math.max(a[1], b[1], c[1]);
      if (maxX < 0 || minX > width || maxY < 0 || minY > height) continue;

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.closePath();
      ctx.fill();

      // Thin edge lines
      ctx.strokeStyle = darken(fillColor, 0.7);
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
  },
};
