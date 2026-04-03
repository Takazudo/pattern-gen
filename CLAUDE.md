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

## Doc Site Commands

```bash
cd doc
pnpm install          # Install doc dependencies
pnpm dev              # Start doc dev server (port 4321)
pnpm build            # Build static site
pnpm preview          # Preview built site
```
