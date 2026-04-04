export interface TokenDef {
  variable: string;
  defaultValue: string;
  label: string;
  type: 'color' | 'length';
}

export interface TokenConfig {
  spacing: {
    hsp: TokenDef[];
    vsp: TokenDef[];
  };
  typography: TokenDef[];
  colors: {
    palette: TokenDef[];
    semantic: TokenDef[];
  };
}

export const tokenConfig: TokenConfig = {
  spacing: {
    hsp: [
      { variable: '--spacing-hsp-2xs', defaultValue: '0.125rem', label: 'hsp-2xs', type: 'length' },
      { variable: '--spacing-hsp-xs', defaultValue: '0.375rem', label: 'hsp-xs', type: 'length' },
      { variable: '--spacing-hsp-sm', defaultValue: '0.5rem', label: 'hsp-sm', type: 'length' },
      { variable: '--spacing-hsp-md', defaultValue: '0.75rem', label: 'hsp-md', type: 'length' },
      { variable: '--spacing-hsp-lg', defaultValue: '1rem', label: 'hsp-lg', type: 'length' },
      { variable: '--spacing-hsp-xl', defaultValue: '1.5rem', label: 'hsp-xl', type: 'length' },
      { variable: '--spacing-hsp-2xl', defaultValue: '2rem', label: 'hsp-2xl', type: 'length' },
    ],
    vsp: [
      { variable: '--spacing-vsp-3xs', defaultValue: '0.25rem', label: 'vsp-3xs', type: 'length' },
      { variable: '--spacing-vsp-2xs', defaultValue: '0.4375rem', label: 'vsp-2xs', type: 'length' },
      { variable: '--spacing-vsp-xs', defaultValue: '0.875rem', label: 'vsp-xs', type: 'length' },
      { variable: '--spacing-vsp-sm', defaultValue: '1.25rem', label: 'vsp-sm', type: 'length' },
      { variable: '--spacing-vsp-md', defaultValue: '1.5rem', label: 'vsp-md', type: 'length' },
      { variable: '--spacing-vsp-lg', defaultValue: '1.75rem', label: 'vsp-lg', type: 'length' },
      { variable: '--spacing-vsp-xl', defaultValue: '2.5rem', label: 'vsp-xl', type: 'length' },
      { variable: '--spacing-vsp-2xl', defaultValue: '3.5rem', label: 'vsp-2xl', type: 'length' },
    ],
  },
  colors: {
    palette: [
      { variable: '--pg-palette-neutral-950', defaultValue: 'oklch(14% 0 0)', label: 'neutral-950', type: 'color' },
      { variable: '--pg-palette-neutral-900', defaultValue: 'oklch(18% 0 0)', label: 'neutral-900', type: 'color' },
      { variable: '--pg-palette-neutral-800', defaultValue: 'oklch(25% 0 0)', label: 'neutral-800', type: 'color' },
      { variable: '--pg-palette-neutral-600', defaultValue: 'oklch(40% 0 0)', label: 'neutral-600', type: 'color' },
      { variable: '--pg-palette-neutral-500', defaultValue: 'oklch(53% 0 0)', label: 'neutral-500', type: 'color' },
      { variable: '--pg-palette-neutral-400', defaultValue: 'oklch(60% 0 0)', label: 'neutral-400', type: 'color' },
      { variable: '--pg-palette-neutral-300', defaultValue: 'oklch(66% 0 0)', label: 'neutral-300', type: 'color' },
      { variable: '--pg-palette-neutral-200', defaultValue: 'oklch(73% 0 0)', label: 'neutral-200', type: 'color' },
      { variable: '--pg-palette-neutral-100', defaultValue: 'oklch(90% 0 0)', label: 'neutral-100', type: 'color' },
      { variable: '--pg-palette-red-500', defaultValue: 'oklch(63% 0.24 25)', label: 'red-500', type: 'color' },
      { variable: '--pg-palette-green-500', defaultValue: 'oklch(70% 0.18 145)', label: 'green-500', type: 'color' },
      { variable: '--pg-palette-yellow-500', defaultValue: 'oklch(80% 0.16 85)', label: 'yellow-500', type: 'color' },
      { variable: '--pg-palette-blue-500', defaultValue: 'oklch(65% 0.18 250)', label: 'blue-500', type: 'color' },
    ],
    semantic: [
      { variable: '--pg-bg', defaultValue: 'oklch(14% 0 0)', label: 'bg', type: 'color' },
      { variable: '--pg-fg', defaultValue: 'oklch(90% 0 0)', label: 'fg', type: 'color' },
      { variable: '--pg-fg-muted', defaultValue: 'oklch(66% 0 0)', label: 'fg-muted', type: 'color' },
      { variable: '--pg-fg-subtle', defaultValue: 'oklch(60% 0 0)', label: 'fg-subtle', type: 'color' },
      { variable: '--pg-fg-faint', defaultValue: 'oklch(40% 0 0)', label: 'fg-faint', type: 'color' },
      { variable: '--pg-surface', defaultValue: 'oklch(18% 0 0)', label: 'surface', type: 'color' },
      { variable: '--pg-muted', defaultValue: 'oklch(40% 0 0)', label: 'muted', type: 'color' },
      { variable: '--pg-accent', defaultValue: 'oklch(53% 0 0)', label: 'accent', type: 'color' },
      { variable: '--pg-accent-hover', defaultValue: 'oklch(73% 0 0)', label: 'accent-hover', type: 'color' },
      { variable: '--pg-border', defaultValue: 'oklch(25% 0 0)', label: 'border', type: 'color' },
    ],
  },
  typography: [
    { variable: '--text-caption', defaultValue: '0.875rem', label: 'caption', type: 'length' },
    { variable: '--text-small', defaultValue: '1rem', label: 'small', type: 'length' },
    { variable: '--text-body', defaultValue: '1.2rem', label: 'body', type: 'length' },
    { variable: '--text-subheading', defaultValue: '1.4rem', label: 'subheading', type: 'length' },
    { variable: '--text-heading', defaultValue: '3rem', label: 'heading', type: 'length' },
    { variable: '--text-display', defaultValue: '3.75rem', label: 'display', type: 'length' },
  ],
};

export function generateTokensCss(): string {
  const lines: string[] = [];
  for (const token of [...tokenConfig.spacing.hsp, ...tokenConfig.spacing.vsp]) {
    lines.push(`  ${token.variable}: ${token.defaultValue};`);
  }
  for (const token of tokenConfig.typography) {
    lines.push(`  ${token.variable}: ${token.defaultValue};`);
  }
  return `:root {\n${lines.join('\n')}\n}`;
}
