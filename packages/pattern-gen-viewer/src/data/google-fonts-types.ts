export interface GoogleFontEntry {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  variants: string[];
}

export type FontCategory = GoogleFontEntry['category'];

export const FONT_CATEGORIES: FontCategory[] = [
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
];

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  'sans-serif': 'Sans Serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
};
