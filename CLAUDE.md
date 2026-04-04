# pattern-gen

Deterministic visual pattern generator — 30 algorithms from geometric tiles to noise-based textures.

## Tech Stack

- TypeScript, ESM
- Canvas 2D rendering (node-canvas for CLI PNG output, native Canvas for browser)
- pnpm workspaces (root library + viewer app)
- tsup for building, vitest for testing

## Architecture

pnpm workspace monorepo with internal sub-packages:

- `packages/core/` (`@takazudo/pattern-gen-core`) — shared utilities (hash, PRNG, noise, color schemes, color utils, types, OGP/Composer config parsing)
- `packages/generators/` (`@takazudo/pattern-gen-generators`) — 30+ pattern generators + 20 frame decorators
- `src/renderer.ts` — rendering pipeline (Node.js PNG + browser canvas), supports HSL adjustments and contrast/brightness transforms
- `src/cli.ts` — CLI entry point with 3 modes: basic, OGP config, Composer config
- `src/index.ts` — re-exports from core + generators + renderer
- `packages/pattern-gen-viewer/` — Vite + React interactive viewer with step-based workflow + Composer
- `packages/styleguide/` — Astro-based component styleguide with React stories
- `doc/` — Documentation site (zudo-doc framework / Astro)

Sub-packages are `private: true` (not published separately). The root package bundles them via tsup `noExternal`.

## CLI Modes

### Basic Mode

```bash
pattern-gen <slug> [options]
```

Flags:
- `--type, -t <name>` — Pattern type (default: wood-block)
- `--size, -s <number>` — Output size in pixels (default: 800)
- `--zoom, -z <number>` — Zoom factor (default: 1)
- `--bg <color>` — Override background color (hex)
- `--color-scheme, -c <name>` — Color scheme name or "random"
- `--hue <number>` — Hue shift (-180 to 180)
- `--saturation <number>` — Saturation shift (-100 to 100)
- `--lightness <number>` — Lightness shift (-100 to 100)
- `--contrast <number>` — Contrast adjustment (-100 to 100)
- `--brightness <number>` — Brightness adjustment (-100 to 100)
- `--out, -o <path>` — Output file path
- `--out-dir <dir>` — Output directory

### OGP Mode

```bash
pattern-gen --ogp-config <path> [--out <path>] [--out-dir <dir>]
```

Renders from OGP config JSON (includes pattern, transforms, HSL, contrast/brightness, crop region). Output: 1200x630 PNG.

### Composer Mode

```bash
pattern-gen --composer-config <path> [--out <path>] [--out-dir <dir>] [--assets-dir <dir>]
```

Renders from Composer config JSON (background pattern + text/image layers + optional frame). `--assets-dir` sets the base directory for resolving relative image paths.

### Utility Flags

- `--list-types` — List available pattern types
- `--list-color-schemes` — List available color schemes
- `--help, -h` — Show help

## Adding a New Pattern

1. Create `packages/generators/src/patterns/<name>.ts` implementing `PatternGenerator` interface
2. Register in `packages/generators/src/patterns/index.ts`
3. Import from `'@takazudo/pattern-gen-core'` for types, utilities, and color functions
4. Pattern receives `(ctx, options)` — draw on the Canvas 2D context
5. Use `options.rand` for all randomness (deterministic)
6. Use `options.colorScheme.palette` for colors (palette[0] = bg, palette[1-7] = fg)

## Commands

```bash
pnpm run build        # Build all packages (core → generators → root)
pnpm run test         # Run vitest
pnpm run typecheck    # TypeScript check
pnpm run viewer:dev   # Start viewer dev server
pnpm run b4push       # Pre-push validation
```

## Domain Language

| Term | Meaning |
|------|---------|
| Pattern | A visual pattern algorithm (e.g., wood-block, voronoi, hexagonal). Selected by `patternType`. |
| Pattern type | The specific algorithm name used to generate a pattern. |
| Composition | A user's saved creation — includes pattern type, seed, color scheme, transforms, layers, and all customizations. Stored in D1 with optional R2 preview. |
| Asset | A user-uploaded image file (PNG, JPG, etc.) stored in R2. Used as image layers in the composer. |
| Composer | The full-screen editor for arranging text/image layers on top of a pattern background. |
| Viewer | The main app interface for browsing and customizing patterns. |
| Seed / Slug | A text string that deterministically generates a pattern. Same seed = same pattern. |
| Color scheme | A named palette of 8 colors (1 background + 7 foreground). |
| OGP Config | A pattern configuration optimized for Open Graph preview images (1200×630). |
| Composer Config | A full composition configuration including background pattern + all layers. |
| Dustbox | Soft-delete trash bin. Deleted compositions/assets go here before permanent deletion. |

## UI Development

### Design System

All UI styling follows the `/l-design-system` skill (auto-invoked when working on viewer components). Key rules:

- **3-tier token system**: Palette (raw oklch) -> Theme (semantic `@theme`) -> Component styles (CSS classes)
- **Styles in `App.css`** for shared/general styles, or **component-specific CSS files** for complex components (no CSS modules)
- **Always use design tokens** for spacing, colors, radius, font sizes — never raw pixel values
- **Glass morphism** for floating panels: `var(--color-surface-glass)` + `backdrop-filter: blur(12px)`
- **No external UI libraries** — build components from scratch using design tokens
- For advanced CSS patterns, invoke `/css-wisdom <topic>`

### Shared Components

Before creating new UI, check if a shared component exists in `packages/pattern-gen-viewer/src/components/`:

- `ConfirmDialog` — reusable confirmation modal with custom content slot
- `CollapsibleSection` — expandable/collapsible panel
- `CompositionMenu` — dropdown menu pattern
- `DiscardConfirmationDialog` — discard/keep/cancel flow

When a UI pattern is used in 2+ places, extract it as a shared component. Prefer extending existing components over creating new ones.

### Styleguide

The styleguide at `packages/styleguide/` auto-discovers `*.stories.tsx` files from the viewer package. When adding or modifying shared components:

1. Create/update a `*.stories.tsx` file alongside the component
2. Add stories for key variants and states
3. Verify with `pnpm run styleguide:dev` (port 14400)

## Doc Site Commands

```bash
cd doc
pnpm install          # Install doc dependencies
pnpm dev              # Start doc dev server (port 4321)
pnpm build            # Build static site
pnpm preview          # Preview built site
```
