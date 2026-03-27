# pattern-gen

Deterministic visual pattern generator — 30 algorithms from geometric tiles to noise-based textures.

## Tech Stack

- TypeScript, ESM
- Canvas 2D rendering (node-canvas for CLI PNG output, native Canvas for browser)
- pnpm workspaces (root library + viewer app)
- tsup for building, vitest for testing

## Architecture

pnpm workspace monorepo with internal sub-packages:

- `packages/core/` (`@takazudo/pattern-gen-core`) — shared utilities (hash, PRNG, noise, color schemes, color utils, types)
- `packages/generators/` (`@takazudo/pattern-gen-generators`) — pattern generators + frame decorators
- `src/renderer.ts` — rendering pipeline (Node.js PNG + browser canvas)
- `src/cli.ts` — CLI entry point (`pattern-gen <slug> --type <name>`)
- `src/index.ts` — re-exports from core + generators + renderer
- `packages/pattern-gen-viewer/` — Vite + React interactive viewer

Sub-packages are `private: true` (not published separately). The root package bundles them via tsup `noExternal`.

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
