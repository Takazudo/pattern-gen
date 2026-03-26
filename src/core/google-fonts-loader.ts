import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';

const fontDir = join(tmpdir(), 'pattern-gen-fonts');
const registeredFonts = new Set<string>();

export async function ensureGoogleFont(
  family: string,
  weight: string = '400',
  style: string = 'normal',
): Promise<void> {
  const key = `${family}-${weight}-${style}`;
  if (registeredFonts.has(key)) return;

  const { registerFont } = await import('canvas');

  // Ensure font cache directory exists
  if (!existsSync(fontDir)) mkdirSync(fontDir, { recursive: true });

  const ttfPath = join(fontDir, `${key}.ttf`);

  if (!existsSync(ttfPath)) {
    // Fetch Google Fonts CSS with TTF user-agent
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const res = await fetch(cssUrl, {
      headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 8.0)' }, // triggers TTF format
    });
    if (!res.ok) throw new Error(`Failed to fetch Google Font "${family}": ${res.status}`);
    const css = await res.text();

    // Extract first TTF/WOFF URL from CSS
    const urlMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (!urlMatch) throw new Error(`Could not find font URL for "${family}" in Google Fonts CSS`);

    const fontRes = await fetch(urlMatch[1]);
    if (!fontRes.ok) throw new Error(`Failed to download font file for "${family}"`);
    const buffer = Buffer.from(await fontRes.arrayBuffer());
    // Atomic write: write to temp file then rename to avoid TOCTOU races
    const tmpPath = `${ttfPath}.${process.pid}.tmp`;
    writeFileSync(tmpPath, buffer);
    renameSync(tmpPath, ttfPath);
  }

  registerFont(ttfPath, {
    family,
    weight: weight === 'bold' || weight === '700' ? 'bold' : 'normal',
    style: style === 'italic' ? 'italic' : 'normal',
  });
  registeredFonts.add(key);
}
