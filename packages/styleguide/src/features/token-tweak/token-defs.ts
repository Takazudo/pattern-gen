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
      { variable: '--zd-0', defaultValue: '#1a1a1a', label: 'p0 (dark surface)', type: 'color' },
      { variable: '--zd-1', defaultValue: '#e05252', label: 'p1 (danger)', type: 'color' },
      { variable: '--zd-2', defaultValue: '#6abf69', label: 'p2 (success)', type: 'color' },
      { variable: '--zd-3', defaultValue: '#e0a84b', label: 'p3 (warning)', type: 'color' },
      { variable: '--zd-4', defaultValue: '#5b9fd6', label: 'p4 (info)', type: 'color' },
      { variable: '--zd-5', defaultValue: '#9a9a9a', label: 'p5 (accent)', type: 'color' },
      { variable: '--zd-6', defaultValue: '#7a7a7a', label: 'p6 (neutral)', type: 'color' },
      { variable: '--zd-7', defaultValue: '#8a8a8a', label: 'p7 (secondary)', type: 'color' },
      { variable: '--zd-8', defaultValue: '#666666', label: 'p8 (muted)', type: 'color' },
      { variable: '--zd-9', defaultValue: '#1a1a1a', label: 'p9 (background)', type: 'color' },
      { variable: '--zd-10', defaultValue: '#2a2a2a', label: 'p10 (surface)', type: 'color' },
      { variable: '--zd-11', defaultValue: '#e6e6e6', label: 'p11 (text)', type: 'color' },
      { variable: '--zd-12', defaultValue: '#a0a0a0', label: 'p12 (accent variant)', type: 'color' },
      { variable: '--zd-13', defaultValue: '#888888', label: 'p13 (decorative)', type: 'color' },
      { variable: '--zd-14', defaultValue: '#b0b0b0', label: 'p14 (accent hover)', type: 'color' },
      { variable: '--zd-15', defaultValue: '#cccccc', label: 'p15 (text secondary)', type: 'color' },
    ],
    semantic: [
      { variable: '--zd-bg', defaultValue: '#1a1a1a', label: 'bg', type: 'color' },
      { variable: '--zd-fg', defaultValue: '#cccccc', label: 'fg', type: 'color' },
      { variable: '--zd-surface', defaultValue: '#1a1a1a', label: 'surface', type: 'color' },
      { variable: '--zd-muted', defaultValue: '#666666', label: 'muted', type: 'color' },
      { variable: '--zd-accent', defaultValue: '#a0a0a0', label: 'accent', type: 'color' },
      { variable: '--zd-accent-hover', defaultValue: '#b0b0b0', label: 'accent-hover', type: 'color' },
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
