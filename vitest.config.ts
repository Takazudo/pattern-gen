import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import path from "node:path";

const viewerRequire = createRequire(
  path.join(import.meta.dirname, "packages/pattern-gen-viewer/package.json"),
);

export default defineConfig({
  resolve: {
    conditions: ["development"],
    alias: {
      // The tracer is a viewer-only dep; resolve to its ESM entry (.mjs)
      "@image-tracer-ts/browser": viewerRequire
        .resolve("@image-tracer-ts/browser")
        .replace(/\.js$/, ".mjs"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
