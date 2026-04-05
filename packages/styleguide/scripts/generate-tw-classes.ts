/**
 * Parses Tailwind v4 @theme CSS blocks from design-system and styleguide
 * CSS files, then generates a JSON file with all available utility class names.
 *
 * Usage: tsx scripts/generate-tw-classes.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Types ───────────────────────────────────────────────────────────────────

interface TwClassEntry {
  label: string;
  detail: string;
  section: string;
}

interface ParsedVar {
  name: string; // full var name without --  e.g. "spacing-hgap-sm"
  value: string; // raw value
}

// ─── Extract @theme blocks ──────────────────────────────────────────────────

function extractThemeVars(css: string): ParsedVar[] {
  const vars: ParsedVar[] = [];
  const themeBlockRe = /@theme\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = themeBlockRe.exec(css)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    let blockContent = '';

    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      if (depth > 0) blockContent += css[i];
      i++;
    }

    // Strip block comments before parsing to avoid matching commented-out vars
    const stripped = blockContent.replace(/\/\*[\s\S]*?\*\//g, '');

    // Parse CSS variable declarations
    const varRe = /--([\w\-/\\]+)\s*:\s*([^;]+);/g;
    let varMatch: RegExpExecArray | null;
    while ((varMatch = varRe.exec(stripped)) !== null) {
      vars.push({ name: varMatch[1], value: varMatch[2].trim() });
    }
  }

  return vars;
}

// ─── Token name extraction helpers ──────────────────────────────────────────

function stripPrefix(name: string, prefix: string): string {
  return name.slice(prefix.length);
}

function formatName(prefix: string, tokenName: string): string {
  if (tokenName === '') return prefix;
  return `${prefix}-${tokenName}`;
}

// Convert escaped fractions in CSS var names to real fractions
// e.g. "1\/2" -> "1/2"
function unescapeFraction(name: string): string {
  return name.replace(/\\\//g, '/');
}

// ─── Mapping functions ──────────────────────────────────────────────────────

function spacingClasses(tokenName: string, value: string): TwClassEntry[] {
  const prefixes = [
    'p',
    'px',
    'py',
    'pt',
    'pb',
    'pl',
    'pr',
    'ps',
    'pe',
    'm',
    'mx',
    'my',
    'mt',
    'mb',
    'ml',
    'mr',
    'ms',
    'me',
    'gap',
    'gap-x',
    'gap-y',
    'space-x',
    'space-y',
    'w',
    'h',
    'size',
    'min-w',
    'min-h',
    'max-w',
    'max-h',
    'top',
    'right',
    'bottom',
    'left',
    'inset',
    'inset-x',
    'inset-y',
    'basis',
    'scroll-m',
    'scroll-p',
  ];

  const cssProps: Record<string, string> = {
    p: 'padding',
    px: 'padding-inline',
    py: 'padding-block',
    pt: 'padding-top',
    pb: 'padding-bottom',
    pl: 'padding-left',
    pr: 'padding-right',
    ps: 'padding-inline-start',
    pe: 'padding-inline-end',
    m: 'margin',
    mx: 'margin-inline',
    my: 'margin-block',
    mt: 'margin-top',
    mb: 'margin-bottom',
    ml: 'margin-left',
    mr: 'margin-right',
    ms: 'margin-inline-start',
    me: 'margin-inline-end',
    gap: 'gap',
    'gap-x': 'column-gap',
    'gap-y': 'row-gap',
    'space-x': 'margin-inline-start (children)',
    'space-y': 'margin-block-start (children)',
    w: 'width',
    h: 'height',
    size: 'width + height',
    'min-w': 'min-width',
    'min-h': 'min-height',
    'max-w': 'max-width',
    'max-h': 'max-height',
    top: 'top',
    right: 'right',
    bottom: 'bottom',
    left: 'left',
    inset: 'inset',
    'inset-x': 'inset-inline',
    'inset-y': 'inset-block',
    basis: 'flex-basis',
    'scroll-m': 'scroll-margin',
    'scroll-p': 'scroll-padding',
  };

  return prefixes.map((pfx) => ({
    label: formatName(pfx, tokenName),
    detail: `${cssProps[pfx]}: ${value}`,
    section: 'spacing',
  }));
}

function colorClasses(tokenName: string, value: string): TwClassEntry[] {
  const prefixes = [
    'bg',
    'text',
    'border',
    'ring',
    'outline',
    'divide',
    'from',
    'via',
    'to',
    'fill',
    'stroke',
    'caret',
    'decoration',
    'placeholder',
    'shadow',
  ];

  const cssProps: Record<string, string> = {
    bg: 'background-color',
    text: 'color',
    border: 'border-color',
    ring: 'ring-color',
    outline: 'outline-color',
    divide: 'divide-color',
    from: 'gradient-from',
    via: 'gradient-via',
    to: 'gradient-to',
    fill: 'fill',
    stroke: 'stroke',
    caret: 'caret-color',
    decoration: 'text-decoration-color',
    placeholder: 'placeholder-color',
    shadow: 'box-shadow color',
  };

  return prefixes.map((pfx) => ({
    label: formatName(pfx, tokenName),
    detail: `${cssProps[pfx]}: ${value}`,
    section: 'color',
  }));
}

function radiusClasses(tokenName: string, value: string): TwClassEntry[] {
  const isDefault = tokenName === '';
  const prefixes = [
    'rounded',
    'rounded-t',
    'rounded-b',
    'rounded-l',
    'rounded-r',
    'rounded-tl',
    'rounded-tr',
    'rounded-bl',
    'rounded-br',
  ];

  const cssProps: Record<string, string> = {
    rounded: 'border-radius',
    'rounded-t': 'border-top-radius',
    'rounded-b': 'border-bottom-radius',
    'rounded-l': 'border-left-radius',
    'rounded-r': 'border-right-radius',
    'rounded-tl': 'border-top-left-radius',
    'rounded-tr': 'border-top-right-radius',
    'rounded-bl': 'border-bottom-left-radius',
    'rounded-br': 'border-bottom-right-radius',
  };

  return prefixes.map((pfx) => ({
    label: isDefault ? pfx : `${pfx}-${tokenName}`,
    detail: `${cssProps[pfx]}: ${value}`,
    section: 'border',
  }));
}

function borderWidthClasses(tokenName: string, value: string): TwClassEntry[] {
  const isDefault = tokenName === '';
  const prefixToProperty: Record<string, string> = {
    border: 'border-width',
    'border-t': 'border-top-width',
    'border-b': 'border-bottom-width',
    'border-l': 'border-left-width',
    'border-r': 'border-right-width',
  };

  return Object.entries(prefixToProperty).map(([pfx, prop]) => ({
    label: isDefault ? pfx : `${pfx}-${tokenName}`,
    detail: `${prop}: ${value}`,
    section: 'border',
  }));
}

// ─── Main processing ────────────────────────────────────────────────────────

function processVars(vars: ParsedVar[]): {
  entries: TwClassEntry[];
  breakpoints: string[];
} {
  const entries: TwClassEntry[] = [];
  const breakpoints: string[] = [];
  const seen = new Set<string>();

  function addEntry(entry: TwClassEntry) {
    if (!seen.has(entry.label)) {
      seen.add(entry.label);
      entries.push(entry);
    }
  }

  function addEntries(list: TwClassEntry[]) {
    for (const entry of list) {
      addEntry(entry);
    }
  }

  for (const v of vars) {
    const { name, value } = v;

    // Skip line-height companion vars
    if (name.endsWith('--line-height')) continue;

    // ── Spacing ──
    if (name.startsWith('spacing-')) {
      const tokenName = stripPrefix(name, 'spacing-');
      addEntries(spacingClasses(tokenName, value));
      continue;
    }

    // ── Color ──
    if (name.startsWith('color-')) {
      const tokenName = stripPrefix(name, 'color-');
      addEntries(colorClasses(tokenName, value));
      continue;
    }

    // ── Font size (--font-size-NAME) — zaudio ──
    // NOTE: Must come before --font-* to avoid `font-size-*` matching the font-family branch.
    if (name.startsWith('font-size-')) {
      const tokenName = stripPrefix(name, 'font-size-');
      addEntry({
        label: `text-${tokenName}`,
        detail: `font-size: ${value}`,
        section: 'typography',
      });
      continue;
    }

    // ── Font weight (--font-weight-NAME) ──
    // NOTE: Must come before --font-* (family) to avoid `font-weight-*` matching family branch.
    if (name.startsWith('font-weight-')) {
      const tokenName = stripPrefix(name, 'font-weight-');
      addEntry({
        label: `font-${tokenName}`,
        detail: `font-weight: ${value}`,
        section: 'typography',
      });
      continue;
    }

    // ── Typography — text sizes (--text-NAME) ──
    if (name.startsWith('text-')) {
      const tokenName = stripPrefix(name, 'text-');
      addEntry({
        label: `text-${tokenName}`,
        detail: `font-size: ${value}`,
        section: 'typography',
      });
      continue;
    }

    // ── Font family (--font-NAME) ──
    if (name.startsWith('font-')) {
      const tokenName = stripPrefix(name, 'font-');
      addEntry({
        label: `font-${tokenName}`,
        detail: `font-family: ${value}`,
        section: 'typography',
      });
      continue;
    }

    // ── Line height (--leading-NAME or --line-height-NAME) ──
    if (name.startsWith('leading-')) {
      const tokenName = stripPrefix(name, 'leading-');
      addEntry({
        label: `leading-${tokenName}`,
        detail: `line-height: ${value}`,
        section: 'typography',
      });
      continue;
    }
    if (name.startsWith('line-height-')) {
      const tokenName = stripPrefix(name, 'line-height-');
      addEntry({
        label: `leading-${tokenName}`,
        detail: `line-height: ${value}`,
        section: 'typography',
      });
      continue;
    }

    // ── Border radius (--radius-NAME) ──
    if (name.startsWith('radius-')) {
      let tokenName = stripPrefix(name, 'radius-');
      if (tokenName === 'DEFAULT') tokenName = '';
      addEntries(radiusClasses(tokenName, value));
      continue;
    }

    // ── Shadow (--shadow-NAME or --shadow) ──
    if (name.startsWith('shadow-') || name === 'shadow') {
      let tokenName = name === 'shadow' ? '' : stripPrefix(name, 'shadow-');
      if (tokenName === 'DEFAULT') tokenName = '';
      addEntry({
        label: tokenName === '' ? 'shadow' : `shadow-${tokenName}`,
        detail: `box-shadow: ${value}`,
        section: 'visual',
      });
      continue;
    }

    // ── Border width (--border-width-NAME) ──
    if (name.startsWith('border-width-')) {
      let tokenName = stripPrefix(name, 'border-width-');
      if (tokenName === 'default' || tokenName === 'DEFAULT') tokenName = '';
      addEntries(borderWidthClasses(tokenName, value));
      continue;
    }

    // ── Breakpoints ──
    if (name.startsWith('breakpoint-')) {
      const tokenName = stripPrefix(name, 'breakpoint-');
      if (!breakpoints.includes(tokenName)) {
        breakpoints.push(tokenName);
      }
      continue;
    }

    // ── Max width (--max-width-NAME) ──
    if (name.startsWith('max-width-')) {
      const rawName = stripPrefix(name, 'max-width-');
      const tokenName = unescapeFraction(rawName);
      addEntry({
        label: `max-w-${tokenName}`,
        detail: `max-width: ${value}`,
        section: 'sizing',
      });
      continue;
    }

    // ── Min width (--min-width-NAME) ──
    if (name.startsWith('min-width-')) {
      const tokenName = unescapeFraction(stripPrefix(name, 'min-width-'));
      addEntry({
        label: `min-w-${tokenName}`,
        detail: `min-width: ${value}`,
        section: 'sizing',
      });
      continue;
    }

    // ── Max height (--max-height-NAME) ──
    if (name.startsWith('max-height-')) {
      const tokenName = unescapeFraction(stripPrefix(name, 'max-height-'));
      addEntry({
        label: `max-h-${tokenName}`,
        detail: `max-height: ${value}`,
        section: 'sizing',
      });
      continue;
    }

    // ── Min height (--min-height-NAME) ──
    if (name.startsWith('min-height-')) {
      const tokenName = unescapeFraction(stripPrefix(name, 'min-height-'));
      addEntry({
        label: `min-h-${tokenName}`,
        detail: `min-height: ${value}`,
        section: 'sizing',
      });
      continue;
    }

    // ── Width (--width-NAME) ──
    if (name.startsWith('width-')) {
      const tokenName = unescapeFraction(stripPrefix(name, 'width-'));
      addEntry({
        label: `w-${tokenName}`,
        detail: `width: ${value}`,
        section: 'sizing',
      });
      continue;
    }

    // ── Height (--height-NAME) ──
    if (name.startsWith('height-')) {
      const tokenName = unescapeFraction(stripPrefix(name, 'height-'));
      addEntry({
        label: `h-${tokenName}`,
        detail: `height: ${value}`,
        section: 'sizing',
      });
      continue;
    }
  }

  return { entries, breakpoints };
}

// ─── Built-in utilities ─────────────────────────────────────────────────────

function getBuiltinClasses(): TwClassEntry[] {
  const builtins: Record<string, [string, string][]> = {
    layout: [
      ['flex', 'display: flex'],
      ['inline-flex', 'display: inline-flex'],
      ['grid', 'display: grid'],
      ['inline-grid', 'display: inline-grid'],
      ['block', 'display: block'],
      ['inline-block', 'display: inline-block'],
      ['inline', 'display: inline'],
      ['hidden', 'display: none'],
      ['contents', 'display: contents'],
      ['table', 'display: table'],
      ['table-row', 'display: table-row'],
      ['table-cell', 'display: table-cell'],
    ],
    flexbox: [
      ['flex-row', 'flex-direction: row'],
      ['flex-col', 'flex-direction: column'],
      ['flex-wrap', 'flex-wrap: wrap'],
      ['flex-nowrap', 'flex-wrap: nowrap'],
      ['flex-1', 'flex: 1 1 0%'],
      ['flex-auto', 'flex: 1 1 auto'],
      ['flex-initial', 'flex: 0 1 auto'],
      ['flex-none', 'flex: none'],
      ['grow', 'flex-grow: 1'],
      ['grow-0', 'flex-grow: 0'],
      ['shrink', 'flex-shrink: 1'],
      ['shrink-0', 'flex-shrink: 0'],
      ['items-start', 'align-items: flex-start'],
      ['items-center', 'align-items: center'],
      ['items-end', 'align-items: flex-end'],
      ['items-baseline', 'align-items: baseline'],
      ['items-stretch', 'align-items: stretch'],
      ['justify-start', 'justify-content: flex-start'],
      ['justify-center', 'justify-content: center'],
      ['justify-end', 'justify-content: flex-end'],
      ['justify-between', 'justify-content: space-between'],
      ['justify-around', 'justify-content: space-around'],
      ['justify-evenly', 'justify-content: space-evenly'],
      ['self-auto', 'align-self: auto'],
      ['self-start', 'align-self: flex-start'],
      ['self-center', 'align-self: center'],
      ['self-end', 'align-self: flex-end'],
      ['self-stretch', 'align-self: stretch'],
      ['order-first', 'order: -9999'],
      ['order-last', 'order: 9999'],
      ['order-none', 'order: 0'],
    ],
    grid: [
      ...Array.from({ length: 12 }, (_, i) => [
        `grid-cols-${i + 1}`,
        `grid-template-columns: repeat(${i + 1}, minmax(0, 1fr))`,
      ]),
      ...Array.from({ length: 12 }, (_, i) => [
        `col-span-${i + 1}`,
        `grid-column: span ${i + 1} / span ${i + 1}`,
      ]),
      ['col-span-full', 'grid-column: 1 / -1'],
      ...Array.from({ length: 6 }, (_, i) => [
        `grid-rows-${i + 1}`,
        `grid-template-rows: repeat(${i + 1}, minmax(0, 1fr))`,
      ]),
      ...Array.from({ length: 6 }, (_, i) => [
        `row-span-${i + 1}`,
        `grid-row: span ${i + 1} / span ${i + 1}`,
      ]),
      ['row-span-full', 'grid-row: 1 / -1'],
      ['grid-flow-row', 'grid-auto-flow: row'],
      ['grid-flow-col', 'grid-auto-flow: column'],
      ['auto-cols-auto', 'grid-auto-columns: auto'],
      ['auto-cols-min', 'grid-auto-columns: min-content'],
      ['auto-cols-max', 'grid-auto-columns: max-content'],
      ['auto-cols-fr', 'grid-auto-columns: minmax(0, 1fr)'],
      ['auto-rows-auto', 'grid-auto-rows: auto'],
      ['auto-rows-min', 'grid-auto-rows: min-content'],
      ['auto-rows-max', 'grid-auto-rows: max-content'],
      ['auto-rows-fr', 'grid-auto-rows: minmax(0, 1fr)'],
      ['place-items-center', 'place-items: center'],
      ['place-content-center', 'place-content: center'],
    ],
    position: [
      ['relative', 'position: relative'],
      ['absolute', 'position: absolute'],
      ['fixed', 'position: fixed'],
      ['sticky', 'position: sticky'],
      ['static', 'position: static'],
      ['z-0', 'z-index: 0'],
      ['z-10', 'z-index: 10'],
      ['z-20', 'z-index: 20'],
      ['z-30', 'z-index: 30'],
      ['z-40', 'z-index: 40'],
      ['z-50', 'z-index: 50'],
      ['z-auto', 'z-index: auto'],
    ],
    overflow: [
      ['overflow-auto', 'overflow: auto'],
      ['overflow-hidden', 'overflow: hidden'],
      ['overflow-visible', 'overflow: visible'],
      ['overflow-scroll', 'overflow: scroll'],
      ['overflow-x-auto', 'overflow-x: auto'],
      ['overflow-x-hidden', 'overflow-x: hidden'],
      ['overflow-y-auto', 'overflow-y: auto'],
      ['overflow-y-hidden', 'overflow-y: hidden'],
    ],
    display: [
      ['visible', 'visibility: visible'],
      ['invisible', 'visibility: hidden'],
      ...([0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100] as const).map(
        (n) => [`opacity-${n}`, `opacity: ${n / 100}`] as [string, string],
      ),
    ],
    typography: [
      ['uppercase', 'text-transform: uppercase'],
      ['lowercase', 'text-transform: lowercase'],
      ['capitalize', 'text-transform: capitalize'],
      ['normal-case', 'text-transform: none'],
      ['italic', 'font-style: italic'],
      ['not-italic', 'font-style: normal'],
      ['underline', 'text-decoration: underline'],
      ['overline', 'text-decoration: overline'],
      ['line-through', 'text-decoration: line-through'],
      ['no-underline', 'text-decoration: none'],
      ['antialiased', '-webkit-font-smoothing: antialiased'],
      ['subpixel-antialiased', '-webkit-font-smoothing: auto'],
      ['text-left', 'text-align: left'],
      ['text-center', 'text-align: center'],
      ['text-right', 'text-align: right'],
      ['text-justify', 'text-align: justify'],
      ['text-start', 'text-align: start'],
      ['text-end', 'text-align: end'],
      ['whitespace-normal', 'white-space: normal'],
      ['whitespace-nowrap', 'white-space: nowrap'],
      ['whitespace-pre', 'white-space: pre'],
      ['whitespace-pre-line', 'white-space: pre-line'],
      ['whitespace-pre-wrap', 'white-space: pre-wrap'],
      ['whitespace-break-spaces', 'white-space: break-spaces'],
      ['break-normal', 'overflow-wrap: normal; word-break: normal'],
      ['break-words', 'overflow-wrap: break-word'],
      ['break-all', 'word-break: break-all'],
      ['break-keep', 'word-break: keep-all'],
      ['truncate', 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap'],
      ['text-ellipsis', 'text-overflow: ellipsis'],
      ['text-clip', 'text-overflow: clip'],
      ['text-wrap', 'text-wrap: wrap'],
      ['text-nowrap', 'text-wrap: nowrap'],
      ['text-balance', 'text-wrap: balance'],
      ['text-pretty', 'text-wrap: pretty'],
      ['select-none', 'user-select: none'],
      ['select-text', 'user-select: text'],
      ['select-all', 'user-select: all'],
      ['select-auto', 'user-select: auto'],
    ],
    border: [
      ['border', 'border-width: 1px'],
      ['border-0', 'border-width: 0px'],
      ['border-t', 'border-top-width: 1px'],
      ['border-b', 'border-bottom-width: 1px'],
      ['border-l', 'border-left-width: 1px'],
      ['border-r', 'border-right-width: 1px'],
      ['border-solid', 'border-style: solid'],
      ['border-dashed', 'border-style: dashed'],
      ['border-dotted', 'border-style: dotted'],
      ['border-double', 'border-style: double'],
      ['border-hidden', 'border-style: hidden'],
      ['border-none', 'border-style: none'],
      ['rounded', 'border-radius: 0.25rem'],
      ['rounded-none', 'border-radius: 0'],
      ['rounded-full', 'border-radius: 9999px'],
    ],
    visual: [
      ['shadow', 'box-shadow: 0 1px 3px rgb(0 0 0 / 0.1)'],
      ['shadow-none', 'box-shadow: none'],
      ['ring', 'box-shadow: ring'],
      ['ring-0', 'box-shadow: ring 0px'],
      ['ring-1', 'box-shadow: ring 1px'],
      ['ring-2', 'box-shadow: ring 2px'],
      ['ring-inset', 'box-shadow: inset ring'],
      ['blur', 'filter: blur(8px)'],
      ['blur-sm', 'filter: blur(4px)'],
      ['blur-md', 'filter: blur(12px)'],
      ['blur-lg', 'filter: blur(16px)'],
      ['grayscale', 'filter: grayscale(100%)'],
      ['invert', 'filter: invert(100%)'],
      ['sepia', 'filter: sepia(100%)'],
      ['backdrop-blur', 'backdrop-filter: blur(8px)'],
      ['backdrop-blur-sm', 'backdrop-filter: blur(4px)'],
    ],
    transition: [
      ['transition', 'transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)'],
      ['transition-all', 'transition-property: all'],
      ['transition-colors', 'transition-property: color, background-color, border-color'],
      ['transition-opacity', 'transition-property: opacity'],
      ['transition-shadow', 'transition-property: box-shadow'],
      ['transition-transform', 'transition-property: transform'],
      ['transition-none', 'transition-property: none'],
      ['duration-75', 'transition-duration: 75ms'],
      ['duration-100', 'transition-duration: 100ms'],
      ['duration-150', 'transition-duration: 150ms'],
      ['duration-200', 'transition-duration: 200ms'],
      ['duration-300', 'transition-duration: 300ms'],
      ['duration-500', 'transition-duration: 500ms'],
      ['duration-700', 'transition-duration: 700ms'],
      ['duration-1000', 'transition-duration: 1000ms'],
      ['ease-linear', 'transition-timing-function: linear'],
      ['ease-in', 'transition-timing-function: cubic-bezier(0.4, 0, 1, 1)'],
      ['ease-out', 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1)'],
      ['ease-in-out', 'transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)'],
      ['animate-none', 'animation: none'],
      ['animate-spin', 'animation: spin 1s linear infinite'],
      ['animate-ping', 'animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'],
      ['animate-pulse', 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'],
      ['animate-bounce', 'animation: bounce 1s infinite'],
    ],
    interactivity: [
      ['cursor-auto', 'cursor: auto'],
      ['cursor-default', 'cursor: default'],
      ['cursor-pointer', 'cursor: pointer'],
      ['cursor-wait', 'cursor: wait'],
      ['cursor-text', 'cursor: text'],
      ['cursor-move', 'cursor: move'],
      ['cursor-not-allowed', 'cursor: not-allowed'],
      ['pointer-events-none', 'pointer-events: none'],
      ['pointer-events-auto', 'pointer-events: auto'],
      ['resize', 'resize: both'],
      ['resize-none', 'resize: none'],
      ['resize-x', 'resize: horizontal'],
      ['resize-y', 'resize: vertical'],
      ['touch-auto', 'touch-action: auto'],
      ['touch-none', 'touch-action: none'],
      ['touch-manipulation', 'touch-action: manipulation'],
      ['scroll-auto', 'scroll-behavior: auto'],
      ['scroll-smooth', 'scroll-behavior: smooth'],
      ['snap-start', 'scroll-snap-align: start'],
      ['snap-center', 'scroll-snap-align: center'],
      ['snap-end', 'scroll-snap-align: end'],
    ],
    sizing: [
      ['w-full', 'width: 100%'],
      ['w-auto', 'width: auto'],
      ['w-screen', 'width: 100vw'],
      ['w-min', 'width: min-content'],
      ['w-max', 'width: max-content'],
      ['w-fit', 'width: fit-content'],
      ['h-full', 'height: 100%'],
      ['h-auto', 'height: auto'],
      ['h-screen', 'height: 100vh'],
      ['h-min', 'height: min-content'],
      ['h-max', 'height: max-content'],
      ['h-fit', 'height: fit-content'],
      ['min-w-0', 'min-width: 0'],
      ['min-w-full', 'min-width: 100%'],
      ['min-w-min', 'min-width: min-content'],
      ['min-w-max', 'min-width: max-content'],
      ['min-w-fit', 'min-width: fit-content'],
      ['min-h-0', 'min-height: 0'],
      ['min-h-full', 'min-height: 100%'],
      ['min-h-screen', 'min-height: 100vh'],
      ['max-w-none', 'max-width: none'],
      ['max-w-full', 'max-width: 100%'],
      ['max-h-none', 'max-height: none'],
      ['max-h-full', 'max-height: 100%'],
      ['max-h-screen', 'max-height: 100vh'],
      ['size-full', 'width: 100%; height: 100%'],
      ['size-auto', 'width: auto; height: auto'],
      ['size-min', 'width: min-content; height: min-content'],
      ['size-max', 'width: max-content; height: max-content'],
      ['size-fit', 'width: fit-content; height: fit-content'],
      ['aspect-auto', 'aspect-ratio: auto'],
      ['aspect-square', 'aspect-ratio: 1 / 1'],
      ['aspect-video', 'aspect-ratio: 16 / 9'],
    ],
    transform: [
      ...([0, 50, 75, 90, 95, 100, 105, 110, 125, 150] as const).map(
        (n) => [`scale-${n}`, `scale: ${n / 100}`] as [string, string],
      ),
      ...([0, 1, 2, 3, 6, 12, 45, 90, 180] as const).map(
        (n) => [`rotate-${n}`, `rotate: ${n}deg`] as [string, string],
      ),
      ['translate-x-0', 'translate: 0 var(--tw-translate-y)'],
      ['translate-y-0', 'translate: var(--tw-translate-x) 0'],
      ['skew-x-0', 'transform: skewX(0deg)'],
      ['skew-y-0', 'transform: skewY(0deg)'],
      ['transform-none', 'transform: none'],
      ['origin-center', 'transform-origin: center'],
      ['origin-top', 'transform-origin: top'],
      ['origin-bottom', 'transform-origin: bottom'],
    ],
    misc: [
      ['sr-only', 'screen-reader only'],
      ['not-sr-only', 'undo screen-reader only'],
      ['isolate', 'isolation: isolate'],
      ['isolation-auto', 'isolation: auto'],
      ['object-contain', 'object-fit: contain'],
      ['object-cover', 'object-fit: cover'],
      ['object-fill', 'object-fit: fill'],
      ['object-none', 'object-fit: none'],
      ['object-scale-down', 'object-fit: scale-down'],
      ['object-center', 'object-position: center'],
      ['object-top', 'object-position: top'],
      ['object-bottom', 'object-position: bottom'],
      ['mix-blend-normal', 'mix-blend-mode: normal'],
      ['mix-blend-multiply', 'mix-blend-mode: multiply'],
      ['list-none', 'list-style-type: none'],
      ['list-disc', 'list-style-type: disc'],
      ['list-decimal', 'list-style-type: decimal'],
      ['list-inside', 'list-style-position: inside'],
      ['list-outside', 'list-style-position: outside'],
      ['appearance-none', 'appearance: none'],
      ['columns-1', 'columns: 1'],
      ['columns-2', 'columns: 2'],
      ['columns-3', 'columns: 3'],
    ],
  };

  const entries: TwClassEntry[] = [];
  for (const [section, items] of Object.entries(builtins)) {
    for (const [label, detail] of items) {
      entries.push({ label, detail, section });
    }
  }
  return entries;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const globalCss = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf-8');

  // Parse global.css for all @theme tokens
  const globalVars = extractThemeVars(globalCss);
  const allVars = [...globalVars];

  const { entries: tokenEntries, breakpoints } = processVars(allVars);
  const builtinEntries = getBuiltinClasses();

  // Merge, dedup by label (token entries take precedence over builtins)
  const seen = new Set<string>();
  const merged: TwClassEntry[] = [];

  for (const entry of tokenEntries) {
    if (!seen.has(entry.label)) {
      seen.add(entry.label);
      merged.push(entry);
    }
  }
  for (const entry of builtinEntries) {
    if (!seen.has(entry.label)) {
      seen.add(entry.label);
      merged.push(entry);
    }
  }

  // Sort alphabetically by label
  merged.sort((a, b) => a.label.localeCompare(b.label));
  breakpoints.sort();

  const output = {
    classes: merged,
    breakpoints,
  };

  const outPath = resolve(ROOT, 'src/data/tw-classes.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf-8');

  // eslint-disable-next-line no-console
  console.error(
    `Generated ${merged.length} classes, ${breakpoints.length} breakpoints → ${outPath}`,
  );
}

main();
