/** HSLA color conversion utilities */

export interface Hsla {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
  a: number; // 0-100
}

/**
 * Parse hex color (#RRGGBB or #RRGGBBAA) to HSLA.
 */
export function hexToHsla(hex: string): Hsla {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const a = hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100), a: Math.round(a * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: Math.round(a * 100),
  };
}

/**
 * Convert HSLA to hex string.
 * Returns #RRGGBB when a=100, #RRGGBBAA otherwise.
 */
export function hslaToHex(h: number, s: number, l: number, a: number): string {
  h = ((h % 360) + 360) % 360;
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  const rgb = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a >= 100) return rgb;
  const alphaHex = Math.round((a / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${rgb}${alphaHex}`;
}

/**
 * Convert HSLA to CSS string: hsla(h, s%, l%, a)
 */
export function hslaToString(h: number, s: number, l: number, a: number): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a / 100})`;
}

/**
 * Parse hsla(...) CSS string back to HSLA object.
 * Returns null if parsing fails.
 */
export function parseHslaString(str: string): Hsla | null {
  const m = str.match(
    /hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\)/,
  );
  if (!m) return null;
  return {
    h: Math.round(Number(m[1])),
    s: Math.round(Number(m[2])),
    l: Math.round(Number(m[3])),
    a: m[4] !== undefined ? Math.round(Number(m[4]) * 100) : 100,
  };
}
