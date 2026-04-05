/**
 * Story registry — auto-discovers all story modules via import.meta.glob
 * and builds a navigable tree grouped by category.
 *
 * PERFORMANCE:
 * - storyMeta: eager, imports only `meta` named export (title strings only)
 * - storyModulesEager: eager, full modules — used at BUILD TIME only
 *   (getStaticPaths, getVariantNames). NOT imported by browser-side code.
 * - storySourceModules: lazy, raw source text on demand
 * - allComponentSources: lazy, raw component source on demand
 *
 * The key optimization: VariantRenderer (browser-side) does NOT import
 * this module. It receives its story path as a prop and dynamically
 * imports only that single story file.
 */

import type { ComponentType, ReactNode } from 'react';
import type { ControlsMap } from '../features/preview/control-types';
import { parseVariants } from './story-module-parser';
export type { StoryVariant } from './story-module-parser';

// Eager but lightweight: only the `meta` named export (title strings)
const storyMeta = import.meta.glob('../../../pattern-gen-viewer/src/**/*.stories.tsx', {
  eager: true,
  import: 'meta',
}) as Record<string, { title?: string } | undefined>;

// Eager full modules — used ONLY at build time (getStaticPaths, getModuleBySlug).
// This is safe because Astro pages run server-side. The browser-side VariantRenderer
// does NOT import from this file, so this glob is NOT bundled into the client.
const storyModulesEager = import.meta.glob('../../../pattern-gen-viewer/src/**/*.stories.tsx', {
  eager: true,
}) as Record<string, Record<string, any>>;

// Lazy: raw source text loaded on demand
const storySourceModules = import.meta.glob('../../../pattern-gen-viewer/src/**/*.stories.tsx', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

// Lazy: component source files loaded on demand
const allComponentSources = import.meta.glob(
  [
    '../../../pattern-gen-viewer/src/**/*.tsx',
    '../../../pattern-gen-viewer/src/**/*.ts',
    '../../../pattern-gen-viewer/src/**/*.css',
  ],
  {
    query: '?raw',
    import: 'default',
  },
) as Record<string, () => Promise<string>>;

// ─── Types ────────────────────────────────────────────

export interface RelatedSource {
  /** Display filename (e.g., "home-article-item.tsx") */
  filename: string;
  /** Raw source code */
  source: string;
  /** Glob-relative path for dev-mode file saving */
  relativePath: string;
}

export interface StoryModule {
  title: string;
  component?: ComponentType<any>;
  parameters?: Record<string, unknown>;
  decorators?: Array<(Story: ComponentType, context: any) => ReactNode>;
  controls?: ControlsMap;
  variants: StoryVariant[];
  source?: string;
  relatedSources: RelatedSource[];
}

export interface CategoryEntry {
  category: string;
  stories: { slug: string; name: string; variantCount: number }[];
}

// ─── Slug utilities ──────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Metadata registry (sync, lightweight) ───────────

interface StoryMetaEntry {
  title: string;
  slug: string;
  path: string;
}

const metaEntries: StoryMetaEntry[] = Object.entries(storyMeta)
  .filter(([, m]) => m?.title)
  .map(([path, m]) => ({
    title: m!.title!,
    slug: slugify(m!.title!),
    path,
  }));

const metaBySlug = new Map<string, StoryMetaEntry>();
for (const entry of metaEntries) {
  metaBySlug.set(entry.slug, entry);
}

// ─── Import resolution ───────────────────────────────

function extractRelativeImports(source: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];
    if (importPath.includes('__test-utils__')) continue;
    if (importPath.includes('styleguide')) continue;
    imports.push(importPath);
  }
  return imports;
}

async function resolveImportSource(
  storyPath: string,
  importPath: string,
): Promise<RelatedSource | null> {
  const storyDir = storyPath.substring(0, storyPath.lastIndexOf('/'));
  const resolved = normalizePath(`${storyDir}/${importPath}`);

  const extensions = ['.tsx', '.ts', '.css', '/index.tsx', '/index.ts'];
  for (const ext of extensions) {
    const fullPath = resolved + ext;
    const loader = allComponentSources[fullPath];
    if (loader) {
      const source = await loader().catch(() => undefined);
      if (source == null) continue;
      const filename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
      return { filename, source, relativePath: fullPath };
    }
  }

  const exactLoader = allComponentSources[resolved];
  if (exactLoader) {
    const source = await exactLoader().catch(() => undefined);
    if (source == null) return null;
    const filename = resolved.substring(resolved.lastIndexOf('/') + 1);
    return { filename, source, relativePath: resolved };
  }

  return null;
}

function normalizePath(path: string): string {
  const parts = path.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (result.length > 0 && result[result.length - 1] !== '..') {
        result.pop();
      } else {
        result.push('..');
      }
    } else {
      result.push(part);
    }
  }
  return result.join('/');
}

// ─── Parse a story module ─────────────────────────────

function toStoryModule(
  raw: Record<string, any>,
  title: string,
  source?: string,
  relatedSources: RelatedSource[] = [],
): StoryModule {
  const meta = raw.meta ?? raw.default ?? {};
  return {
    title,
    component: meta.component,
    parameters: meta.parameters,
    decorators: meta.decorators,
    controls: raw.controls as ControlsMap | undefined,
    variants: parseVariants(raw),
    source,
    relatedSources,
  };
}

// ─── Public API ──────────────────────────────────────

/**
 * Build category tree from lightweight metadata (sync, no component loading).
 */
export function getCategoryTree(): CategoryEntry[] {
  const map = new Map<string, CategoryEntry['stories']>();

  for (const entry of metaEntries) {
    const parts = entry.title.split('/');
    const category = parts.length > 1 ? parts[0] : 'General';
    const name = parts.length > 1 ? parts.slice(1).join('/') : parts[0];

    // Get variant count from eager modules (server-side only)
    const raw = storyModulesEager[entry.path];
    const variantCount = raw
      ? Object.keys(raw).filter((k) => k !== 'default' && k !== 'meta' && k !== 'controls').length
      : 0;

    if (!map.has(category)) map.set(category, []);
    map.get(category)!.push({ slug: entry.slug, name, variantCount });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, stories]) => ({
      category,
      stories: stories.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * Get a fully loaded StoryModule by slug (async).
 * Loads story module + source text + related component sources.
 * Used on [slug].astro story pages (server-side).
 */
export async function getModuleBySlug(slug: string): Promise<StoryModule | undefined> {
  const entry = metaBySlug.get(slug);
  if (!entry) return undefined;

  const raw = storyModulesEager[entry.path];
  if (!raw) return undefined;

  const sourceLoader = storySourceModules[entry.path];
  const source = sourceLoader ? await sourceLoader().catch(() => undefined) : undefined;

  const relatedSources: RelatedSource[] = [];
  if (source) {
    const importPaths = extractRelativeImports(source);
    const results = await Promise.all(
      importPaths.map((importPath) => resolveImportSource(entry.path, importPath)),
    );
    for (const rs of results) {
      if (rs) relatedSources.push(rs);
    }
  }

  return toStoryModule(raw, entry.title, source, relatedSources);
}

/**
 * Get a StoryModule by slug without loading sources (sync).
 * Used by VariantRenderer (browser) and preview getStaticPaths.
 * Returns the full component/variant data from the eager glob.
 */
export function getModuleBySlugSync(slug: string): StoryModule | undefined {
  const entry = metaBySlug.get(slug);
  if (!entry) return undefined;
  const raw = storyModulesEager[entry.path];
  if (!raw) return undefined;
  return toStoryModule(raw, entry.title);
}

/**
 * Get the glob-relative path for a story by slug.
 */
export function getStoryPath(slug: string): string | undefined {
  return metaBySlug.get(slug)?.path;
}

export function getAllSlugs(): string[] {
  return metaEntries.map((e) => e.slug);
}
