/** A color reference: palette index (number) or direct color value (string) */
export type ColorRef = number | string;

export interface ColorScheme {
  background: ColorRef;
  foreground: ColorRef;
  cursor: ColorRef;
  selectionBg: ColorRef;
  selectionFg: ColorRef;
  palette: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  shikiTheme: NonNullable<import('astro').ShikiConfig['theme']>;
  /** Optional semantic overrides — when omitted, defaults are used. */
  semantic?: {
    surface?: ColorRef;
    muted?: ColorRef;
    accent?: ColorRef;
    accentHover?: ColorRef;
    codeBg?: ColorRef;
    codeFg?: ColorRef;
    success?: ColorRef;
    danger?: ColorRef;
    warning?: ColorRef;
    info?: ColorRef;
  };
}

/**
 * Pattern Gen dark-only color scheme.
 * oklch neutral palette matching the viewer's design system.
 */
export const colorSchemes: Record<string, ColorScheme> = {
  'Default Dark': {
    background: 9,
    foreground: 15,
    cursor: 6,
    selectionBg: 10,
    selectionFg: 11,
    palette: [
      '#1a1a1a',
      '#e05252',
      '#6abf69',
      '#e0a84b', // p0-3: dark surface, danger, success, warning
      '#5b9fd6',
      '#9a9a9a',
      '#7a7a7a',
      '#8a8a8a', // p4-7: info, accent, neutral, secondary
      '#666666',
      '#1a1a1a',
      '#2a2a2a',
      '#e6e6e6', // p8-11: muted, background, surface, text
      '#a0a0a0',
      '#888888',
      '#b0b0b0',
      '#cccccc', // p12-15: accent variant, decorative, hover, text secondary
    ],
    shikiTheme: 'vitesse-dark',
    semantic: {
      surface: 0,
      muted: 8,
      accent: 12,
      accentHover: 14,
      codeBg: 10,
      codeFg: 11,
      success: 2,
      danger: 1,
      warning: 3,
      info: 4,
    },
  },
};
