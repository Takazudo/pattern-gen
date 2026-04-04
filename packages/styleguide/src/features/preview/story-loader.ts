/**
 * Lazy story loader for browser-side VariantRenderer.
 *
 * Unlike stories.ts (which eagerly loads ALL story modules for server-side use),
 * this module uses lazy import.meta.glob so each story is a separate chunk.
 * The browser only downloads the single story file it needs.
 *
 * The story's glob path is resolved server-side (in the Astro page) and passed
 * as a prop, so NO eager glob is needed here — zero upfront loading.
 */

// Lazy: each story loaded on demand as a separate chunk
const storyLoaders = import.meta.glob('../../../../pattern-gen-viewer/src/**/*.stories.tsx') as Record<
  string,
  () => Promise<Record<string, any>>
>;

// Normalize keys: strip leading segments to get stable "pattern-gen-viewer/src/..." paths.
const loadersByNormalizedPath = new Map<string, () => Promise<Record<string, any>>>();
for (const [path, loader] of Object.entries(storyLoaders)) {
  const match = path.match(/(pattern-gen-viewer\/src\/.+)$/);
  if (match) loadersByNormalizedPath.set(match[1], loader);
}

/**
 * Load a single story module by its glob-relative path.
 * The path comes from the server-side stories.ts registry (via Astro props).
 * Paths are normalized to "components/..." for stable matching.
 */
export async function loadStoryByPath(path: string): Promise<Record<string, any> | null> {
  const match = path.match(/(pattern-gen-viewer\/src\/.+)$/);
  if (!match) return null;
  const loader = loadersByNormalizedPath.get(match[1]);
  if (!loader) return null;
  return loader() as Promise<Record<string, any>>;
}
