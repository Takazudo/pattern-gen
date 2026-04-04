/**
 * Maps the existing story category tree to zudo-doc's NavNode format
 * for sidebar navigation.
 */

import { getCategoryTree } from '../data/stories';
import type { CategoryEntry } from '../data/stories';

export interface NavNode {
  slug: string;
  label: string;
  description?: string;
  position: number;
  href?: string;
  hasPage: boolean;
  children: NavNode[];
  sortOrder?: 'asc' | 'desc';
}

function storyToNavNode(
  story: CategoryEntry['stories'][number],
  position: number,
  basePath: string,
): NavNode {
  return {
    slug: story.slug,
    label: story.name,
    position,
    href: `${basePath}/${story.slug}`,
    hasPage: true,
    children: [],
  };
}

function categoryToNavNode(category: CategoryEntry, position: number, basePath: string): NavNode {
  return {
    slug: `__category__${slugifyCategory(category.category)}`,
    label: category.category,
    position,
    hasPage: false,
    children: category.stories.map((story, i) => storyToNavNode(story, i, basePath)),
  };
}

function slugifyCategory(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build sidebar NavNode[] from the auto-discovered story tree.
 * @param basePath - Base URL path (e.g. import.meta.env.BASE_URL without trailing slash)
 */
export function getStorySidebarNodes(basePath = ''): NavNode[] {
  const base = basePath.replace(/\/$/, '');
  const categories = getCategoryTree();
  return categories.map((cat, i) => categoryToNavNode(cat, i, base));
}
