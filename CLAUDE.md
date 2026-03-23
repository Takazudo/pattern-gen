# pattern-gen

Deterministic visual pattern generator — 30 algorithms from geometric tiles to noise-based textures.

## Tech Stack

- TypeScript, ESM
- Canvas 2D rendering (node-canvas for CLI PNG output, native Canvas for browser)
- pnpm workspaces (root library + viewer app)
- tsup for building, vitest for testing

## Architecture

- `src/core/` — shared utilities (hash, PRNG, noise, color schemes, color utils)
- `src/patterns/` — individual pattern generators, each exports a `PatternGenerator`
- `src/renderer.ts` — rendering pipeline (Node.js PNG + browser canvas)
- `src/cli.ts` — CLI entry point (`pattern-gen <slug> --type <name>`)
- `packages/pattern-gen-viewer/` — Vite + React interactive viewer

## Adding a New Pattern

1. Create `src/patterns/<name>.ts` implementing `PatternGenerator` interface
2. Register in `src/patterns/index.ts`
3. Pattern receives `(ctx, options)` — draw on the Canvas 2D context
4. Use `options.rand` for all randomness (deterministic)
5. Use `options.colorScheme.palette` for colors (palette[0] = bg, palette[1-7] = fg)

## Commands

```bash
pnpm run build        # Build with tsup
pnpm run test         # Run vitest
pnpm run typecheck    # TypeScript check
pnpm run viewer:dev   # Start viewer dev server
pnpm run b4push       # Pre-push validation
```
