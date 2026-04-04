/**
 * Sidebar configuration for the styleguide.
 *
 * Two sections, each with its own sidebar:
 * - Tokens: design system reference pages (tokens + CSS architecture)
 * - Components: auto-discovered story categories (default "!" section)
 */

import type { NavNode } from '../utils/story-sidebar';
import { getStorySidebarNodes } from '../utils/story-sidebar';
import { docsUrl } from '../utils/base';

/**
 * Get sidebar nodes for a specific nav section.
 * Called by sidebar.astro with the current navSection from nav-scope.
 */
export function getSidebarNodes(basePath = '', navSection?: string): NavNode[] {
  const base = basePath.replace(/\/$/, '');

  if (navSection === 'tokens') {
    // Design System section — static navigation
    return [
      {
        slug: 'tokens',
        label: 'Design Tokens',
        position: 0,
        href: `${base}/tokens`,
        hasPage: true,
        children: [],
      },
      {
        slug: 'tokens/css-architecture',
        label: 'CSS Architecture',
        position: 1,
        href: docsUrl('tokens/css-architecture'),
        hasPage: true,
        children: [],
      },
    ];
  }

  // Default ("!") section — component stories
  return getStorySidebarNodes(base);
}
