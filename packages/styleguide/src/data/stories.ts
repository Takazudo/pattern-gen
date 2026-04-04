export interface StoryMeta {
  title: string;
}

export interface StoryEntry {
  /** Slug used in URL: e.g. "collapsible-section" */
  slug: string;
  /** Display title from meta: e.g. "CollapsibleSection" */
  name: string;
  /** Category parsed from meta title: e.g. "UI" */
  category: string;
  /** Variant names (named exports except meta/default) */
  variants: string[];
  /** Module loader */
  module: () => Promise<Record<string, unknown>>;
}

export interface CategoryGroup {
  category: string;
  stories: StoryEntry[];
}

// Discover all *.stories.tsx files in the viewer package
const storyModules = import.meta.glob<Record<string, unknown>>(
  '../../../pattern-gen-viewer/src/**/*.stories.tsx',
);

function parseStoryModule(
  path: string,
  loader: () => Promise<Record<string, unknown>>,
): StoryEntry | null {
  const filename = path.split('/').pop()?.replace('.stories.tsx', '') ?? '';
  const name = filename
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  return {
    slug: filename,
    name,
    category: 'UI',
    variants: [],
    module: loader,
  };
}

let _storiesCache: StoryEntry[] | null = null;

export function getStories(): StoryEntry[] {
  if (_storiesCache) return _storiesCache;

  const entries: StoryEntry[] = [];
  for (const [path, loader] of Object.entries(storyModules)) {
    const entry = parseStoryModule(path, loader);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  _storiesCache = entries;
  return entries;
}

export function getStoriesByCategory(): CategoryGroup[] {
  const stories = getStories();
  const categoryMap = new Map<string, StoryEntry[]>();

  for (const story of stories) {
    const existing = categoryMap.get(story.category);
    if (existing) {
      existing.push(story);
    } else {
      categoryMap.set(story.category, [story]);
    }
  }

  return Array.from(categoryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, stories]) => ({ category, stories }));
}

/**
 * Resolve a story module: load it, extract meta + variants.
 * Returns a copy of the parsed data without mutating cached entries.
 */
export async function resolveStory(
  entry: StoryEntry,
): Promise<{
  meta: StoryMeta;
  variants: { name: string; render: () => unknown }[];
}> {
  const mod = await entry.module();
  const meta = (mod.meta as StoryMeta) ?? { title: `${entry.category}/${entry.name}` };

  const variants: { name: string; render: () => unknown }[] = [];
  for (const [key, value] of Object.entries(mod)) {
    if (key === 'meta' || key === 'default') continue;
    if (typeof value === 'function') {
      variants.push({ name: key, render: value as () => unknown });
    }
  }

  return { meta, variants };
}
