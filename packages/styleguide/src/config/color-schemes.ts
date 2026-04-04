/**
 * Three-tier color system:
 *   Tier 1 (Palette): Raw oklch colors by name — no semantic meaning.
 *   Tier 2 (Semantic): Role-based tokens referencing palette keys.
 *   Tier 3 (Component): CSS classes using semantic tokens via @theme.
 */

export interface ColorScheme {
  /** Tier 1: Named raw color values (oklch). Never used directly in components. */
  palette: Record<string, string>;
  /** Tier 2: Semantic roles mapping to palette key names. */
  semantic: Record<string, string>;
  shikiTheme: NonNullable<import('astro').ShikiConfig['theme']>;
}

/**
 * Pattern Gen dark-only color scheme.
 * oklch neutral palette matching the viewer's design system.
 */
export const colorSchemes: Record<string, ColorScheme> = {
  'Default Dark': {
    palette: {
      // Neutrals
      'neutral-950': 'oklch(14% 0 0)', // near-black
      'neutral-900': 'oklch(18% 0 0)', // very dark
      'neutral-800': 'oklch(25% 0 0)', // dark surface
      'neutral-600': 'oklch(40% 0 0)', // muted
      'neutral-500': 'oklch(53% 0 0)', // mid gray
      'neutral-400': 'oklch(60% 0 0)', // subtle
      'neutral-300': 'oklch(66% 0 0)', // secondary text
      'neutral-200': 'oklch(73% 0 0)', // text
      'neutral-100': 'oklch(90% 0 0)', // bright text
      // Status colors
      'red-500': 'oklch(63% 0.24 25)',
      'green-500': 'oklch(70% 0.18 145)',
      'yellow-500': 'oklch(80% 0.16 85)',
      'blue-500': 'oklch(65% 0.18 250)',
    },
    semantic: {
      bg: 'neutral-950',
      fg: 'neutral-100',
      'fg-muted': 'neutral-300',
      'fg-subtle': 'neutral-400',
      'fg-faint': 'neutral-600',
      surface: 'neutral-900',
      muted: 'neutral-600',
      accent: 'neutral-500',
      'accent-hover': 'neutral-200',
      border: 'neutral-800',
      'code-bg': 'neutral-900',
      'code-fg': 'neutral-100',
      cursor: 'neutral-500',
      'sel-bg': 'neutral-800',
      'sel-fg': 'neutral-100',
      danger: 'red-500',
      success: 'green-500',
      warning: 'yellow-500',
      info: 'blue-500',
      // Mermaid
      'mermaid-node-bg': 'neutral-950',
      'mermaid-text': 'neutral-100',
      'mermaid-line': 'neutral-800',
      'mermaid-label-bg': 'neutral-900',
      'mermaid-note-bg': 'neutral-950',
      // Chat
      'chat-user-bg': 'neutral-500',
      'chat-user-text': 'neutral-950',
      'chat-assistant-bg': 'neutral-950',
      'chat-assistant-text': 'neutral-100',
    },
    shikiTheme: 'vitesse-dark',
  },
};
