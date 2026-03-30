import type { PatternGenerator, PatternOptions } from '@takazudo/pattern-gen-core';

/**
 * Solid Color — fills the canvas with a single background color.
 * The simplest pattern: the color scheme selector IS the control.
 */
export const solidColor: PatternGenerator = {
  name: 'solid-color',
  displayName: 'Solid Color',
  description: 'Single solid background color from the active color scheme',

  generate(ctx: CanvasRenderingContext2D, options: PatternOptions): void {
    const { width, height, colorScheme } = options;
    ctx.fillStyle = colorScheme.palette[0];
    ctx.fillRect(0, 0, width, height);
  },
};
