import { colorSchemes, type ColorScheme } from './color-schemes';
import { settings } from './settings';

/**
 * Default semantic palette-index mappings for the color tweak panel.
 * The tweak panel uses a 16-slot indexed palette internally;
 * these defaults map semantic keys to slot indices.
 */
export const SEMANTIC_DEFAULTS: Record<string, number> = {
  bg: 9,
  fg: 7,
  surface: 10,
  muted: 8,
  accent: 5,
  accentHover: 14,
  codeBg: 10,
  codeFg: 11,
  success: 2,
  danger: 1,
  warning: 3,
  info: 4,
  mermaidNodeBg: 9,
  mermaidText: 11,
  mermaidLine: 8,
  mermaidLabelBg: 10,
  mermaidNoteBg: 0,
  chatUserBg: 5,
  chatUserText: 9,
  chatAssistantBg: 9,
  chatAssistantText: 11,
};

/**
 * CSS variable names for semantic tokens.
 * Used by the doc-layout inline script and tweak panel.
 */
export const SEMANTIC_CSS_NAMES: Record<string, string> = {
  surface: '--pg-surface',
  muted: '--pg-muted',
  accent: '--pg-accent',
  accentHover: '--pg-accent-hover',
  codeBg: '--pg-code-bg',
  codeFg: '--pg-code-fg',
  success: '--pg-success',
  danger: '--pg-danger',
  warning: '--pg-warning',
  info: '--pg-info',
  mermaidNodeBg: '--pg-mermaid-node-bg',
  mermaidText: '--pg-mermaid-text',
  mermaidLine: '--pg-mermaid-line',
  mermaidLabelBg: '--pg-mermaid-label-bg',
  mermaidNoteBg: '--pg-mermaid-note-bg',
  chatUserBg: '--pg-chat-user-bg',
  chatUserText: '--pg-chat-user-text',
  chatAssistantBg: '--pg-chat-assistant-bg',
  chatAssistantText: '--pg-chat-assistant-text',
};

export const lightDarkPairings = [
  { light: 'Default Light', dark: 'Default Dark', label: 'Default' },
];

export function getActiveScheme(): ColorScheme {
  const scheme = colorSchemes[settings.colorScheme];
  if (!scheme) {
    throw new Error(
      `Unknown color scheme: "${settings.colorScheme}". Available: ${Object.keys(colorSchemes).join(', ')}`,
    );
  }
  return scheme;
}

/**
 * Convert a three-tier ColorScheme to CSS custom property pairs.
 *
 * Emits:
 *   --pg-palette-{name}: {value}       (Tier 1: raw palette)
 *   --pg-{semantic}: var(--pg-palette-{paletteKey})  (Tier 2: semantic)
 */
export function schemeToCssPairs(scheme: ColorScheme): [string, string][] {
  const pairs: [string, string][] = [];

  // Tier 1: Palette — raw color values
  for (const [name, value] of Object.entries(scheme.palette)) {
    pairs.push([`--pg-palette-${name}`, value]);
  }

  // Tier 2: Semantic — reference palette vars
  for (const [name, paletteKey] of Object.entries(scheme.semantic)) {
    pairs.push([`--pg-${name}`, `var(--pg-palette-${paletteKey})`]);
  }

  return pairs;
}

export function generateCssCustomProperties(): string {
  const scheme = getActiveScheme();
  const pairs = schemeToCssPairs(scheme);
  const lines = [':root {', ...pairs.map(([prop, value]) => `  ${prop}: ${value};`), '}'];
  return lines.join('\n');
}

export function generateLightDarkCssProperties(): string {
  if (!settings.colorMode) {
    throw new Error('colorMode is not configured');
  }
  const { lightScheme, darkScheme } = settings.colorMode;
  const light = colorSchemes[lightScheme];
  const dark = colorSchemes[darkScheme];
  if (!light) throw new Error(`Unknown light scheme: "${lightScheme}"`);
  if (!dark) throw new Error(`Unknown dark scheme: "${darkScheme}"`);

  const lightPairs = schemeToCssPairs(light);
  const darkPairs = schemeToCssPairs(dark);

  if (lightPairs.length !== darkPairs.length) {
    throw new Error(
      `Light scheme has ${lightPairs.length} properties but dark scheme has ${darkPairs.length}`,
    );
  }

  const lines = [':root {', '  color-scheme: light dark;'];
  for (let i = 0; i < lightPairs.length; i++) {
    const prop = lightPairs[i][0];
    const lightVal = lightPairs[i][1];
    const darkVal = darkPairs[i][1];
    lines.push(`  ${prop}: light-dark(${lightVal}, ${darkVal});`);
  }
  lines.push('}');
  return lines.join('\n');
}
