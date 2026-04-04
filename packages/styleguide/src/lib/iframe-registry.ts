/**
 * Iframe registry for live token updates.
 *
 * Uses direct DOM queries (document.querySelectorAll("iframe")) to find
 * all iframes on the page. Overrides are stored on `window` so all
 * Astro island bundles share state.
 *
 * The three-tier token system uses:
 *   --pg-palette-{name}  (Tier 1: raw colors)
 *   --pg-{semantic}      (Tier 2: semantic roles)
 *   --color-{name}       (Tier 3: @theme component tokens)
 *
 * Overrides set --pg-* vars directly; the @theme tokens resolve through
 * the CSS variable chain.
 */

const OVERRIDES_KEY = '__styleguideTokenOverrides';

function getOverrides(): Record<string, string> {
  const w = globalThis as unknown as Record<string, Record<string, string>>;
  if (!w[OVERRIDES_KEY]) {
    w[OVERRIDES_KEY] = {};
  }
  return w[OVERRIDES_KEY];
}

function setOverridesStore(overrides: Record<string, string>): void {
  (globalThis as unknown as Record<string, Record<string, string>>)[OVERRIDES_KEY] = overrides;
}

function getAllIframes(): HTMLIFrameElement[] {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll('iframe'));
}

function applyOverridesToIframe(
  iframe: HTMLIFrameElement,
  overrides: Record<string, string>,
): void {
  try {
    const root = iframe.contentDocument?.documentElement;
    if (!root) return;
    for (const [variable, value] of Object.entries(overrides)) {
      root.style.setProperty(variable, value);
    }
  } catch {
    // cross-origin iframe — skip
  }
}

/** Called by VariantPreview/HtmlPreview on load — applies current overrides + CSS injections */
export function registerIframe(el: HTMLIFrameElement): void {
  const overrides = getOverrides();
  if (Object.keys(overrides).length > 0) {
    applyOverridesToIframe(el, overrides);
  }
  // Replay CSS injections into the newly loaded iframe
  const cssStore = getCssInjections();
  for (const [id, cssText] of Object.entries(cssStore)) {
    try {
      const doc = el.contentDocument;
      if (!doc) continue;
      const style = doc.createElement('style');
      style.id = `${CSS_INJECT_PREFIX}${id}`;
      style.textContent = cssText;
      doc.head.appendChild(style);
    } catch {
      // cross-origin — skip
    }
  }
}

/** No-op kept for API compatibility */
export function unregisterIframe(_el: HTMLIFrameElement): void {
  // No longer tracking a Set — using DOM queries instead
}

export function applyToAllIframes(variable: string, value: string): void {
  const patch = { [variable]: value };
  const merged = { ...getOverrides(), ...patch };
  setOverridesStore(merged);
  for (const iframe of getAllIframes()) {
    applyOverridesToIframe(iframe, patch);
  }
}

export function setGlobalOverrides(overrides: Record<string, string>): void {
  // Merge with existing overrides instead of replacing, so multiple panels
  // (ColorTweakPanel + TokenTweakPanel) don't clobber each other.
  const merged = { ...getOverrides(), ...overrides };
  setOverridesStore(merged);
  for (const iframe of getAllIframes()) {
    applyOverridesToIframe(iframe, merged);
  }
}

export function resetGlobalOverrides(): void {
  const keysToRemove = Object.keys(getOverrides());
  setOverridesStore({});
  for (const iframe of getAllIframes()) {
    try {
      const root = iframe.contentDocument?.documentElement;
      if (!root) continue;
      for (const variable of keysToRemove) {
        root.style.removeProperty(variable);
      }
    } catch {
      // cross-origin iframe — skip
    }
  }
}

// ─── CSS text injection (for live code-panel sync) ───

const CSS_INJECT_PREFIX = 'sg-css-inject-';
const CSS_INJECTIONS_KEY = '__styleguideCssInjections';

function getCssInjections(): Record<string, string> {
  const w = globalThis as unknown as Record<string, Record<string, string>>;
  if (!w[CSS_INJECTIONS_KEY]) {
    w[CSS_INJECTIONS_KEY] = {};
  }
  return w[CSS_INJECTIONS_KEY];
}

/**
 * Inject or update a `<style>` block in every preview iframe.
 * Each injection is keyed by `id` so repeated calls update in place.
 * The injection is persisted so that newly loaded iframes also receive it.
 */
export function injectCssToAllIframes(id: string, cssText: string): void {
  const store = getCssInjections();
  store[id] = cssText;

  const styleId = `${CSS_INJECT_PREFIX}${id}`;
  for (const iframe of getAllIframes()) {
    try {
      const doc = iframe.contentDocument;
      if (!doc) continue;
      let style = doc.getElementById(styleId) as HTMLStyleElement | null;
      if (!style) {
        style = doc.createElement('style');
        style.id = styleId;
        doc.head.appendChild(style);
      }
      style.textContent = cssText;
    } catch {
      // cross-origin iframe — skip
    }
  }
}

/** Reload all preview iframes (e.g., after non-CSS source edits). */
export function reloadAllIframes(): void {
  for (const iframe of getAllIframes()) {
    try {
      iframe.contentWindow?.location.reload();
    } catch {
      // cross-origin iframe — skip
    }
  }
}

/** Remove a previously injected CSS block from all iframes. */
export function removeCssFromAllIframes(id: string): void {
  const store = getCssInjections();
  delete store[id];

  const styleId = `${CSS_INJECT_PREFIX}${id}`;
  for (const iframe of getAllIframes()) {
    try {
      const el = iframe.contentDocument?.getElementById(styleId);
      el?.remove();
    } catch {
      // cross-origin iframe — skip
    }
  }
}
