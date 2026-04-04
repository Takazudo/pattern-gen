/**
 * Sidebar configuration for the styleguide.
 *
 * Two sections, each with its own sidebar:
 * - Tokens: design token reference pages
 * - Components: auto-discovered story categories (default "!" section)
 */

import type { NavNode } from '../utils/story-sidebar';
import { getStorySidebarNodes } from '../utils/story-sidebar';

/**
 * Get sidebar nodes for a specific nav section.
 * Called by sidebar.astro with the current navSection from nav-scope.
 */
export function getSidebarNodes(basePath = '', navSection?: string): NavNode[] {
  const base = basePath.replace(/\/$/, '');

  if (navSection === 'tokens') {
    // Tokens section — static navigation
    return [
      {
        slug: 'tokens',
        label: 'Design Tokens',
        position: 0,
        href: `${base}/tokens`,
        hasPage: true,
        children: [],
      },
    ];
  }

  // Default ("!") section — component stories
  return getStorySidebarNodes(base);
}
