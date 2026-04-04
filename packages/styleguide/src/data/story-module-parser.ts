/**
 * Shared story module types and parsing logic.
 *
 * This file is imported by both:
 * - stories.ts (server-side, has eager globs)
 * - variant-renderer.tsx (browser-side, uses lazy loading)
 *
 * It contains NO import.meta.glob calls, so importing it does not
 * pull any story files into the bundle.
 */

import type { ComponentType, ReactNode } from 'react';
import type { ControlsMap } from '../features/preview/control-types';

export interface StoryVariant {
  name: string;
  args?: Record<string, unknown>;
  render?: ComponentType<any>;
  parameters?: Record<string, unknown>;
  decorators?: Array<(Story: ComponentType, context: any) => ReactNode>;
}

export function parseVariants(raw: Record<string, any>): StoryVariant[] {
  const variants: StoryVariant[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'default' || key === 'meta' || key === 'controls') continue;
    if (typeof value === 'function') {
      variants.push({ name: key, render: value as ComponentType<any> });
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      const v = value as Record<string, any>;
      variants.push({
        name: key,
        args: v.args,
        render: v.render,
        parameters: v.parameters,
        decorators: v.decorators,
      });
    }
  }
  return variants;
}

export interface ParsedStory {
  component?: ComponentType<any>;
  parameters?: Record<string, unknown>;
  decorators?: Array<(Story: ComponentType, context: any) => ReactNode>;
  controls?: ControlsMap;
  variants: StoryVariant[];
}

export function parseStoryModule(raw: Record<string, any>): ParsedStory {
  const meta = raw.meta ?? raw.default ?? {};
  return {
    component: meta.component,
    parameters: meta.parameters,
    decorators: meta.decorators,
    controls: raw.controls as ControlsMap | undefined,
    variants: parseVariants(raw),
  };
}
