import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

const viewerSrc = fileURLToPath(
  new URL("../pattern-gen-viewer/src", import.meta.url),
);
const mocksDir = fileURLToPath(new URL("./src/mocks", import.meta.url));

/**
 * Vite plugin that redirects viewer dependency imports to styleguide mocks.
 * This lets viewer components render in the styleguide without a real backend.
 */
function mockViewerDeps(): Plugin {
  // Pre-compute the absolute paths that should be intercepted
  const authContextPath = path.join(viewerSrc, "contexts", "auth-context");
  const apiClientPath = path.join(viewerSrc, "lib", "api-client");

  return {
    name: "styleguide-mock-viewer-deps",
    enforce: "pre",
    resolveId(source, importer) {
      // Match both relative and absolute import specifiers
      if (
        source.endsWith("/contexts/auth-context.js") ||
        source.endsWith("/contexts/auth-context")
      ) {
        return path.join(mocksDir, "mock-auth-context.tsx");
      }
      if (
        source.endsWith("/lib/api-client.js") ||
        source.endsWith("/lib/api-client")
      ) {
        return path.join(mocksDir, "mock-api-client.ts");
      }
      // Also match if Vite already resolved to absolute path
      if (source.startsWith(authContextPath)) {
        return path.join(mocksDir, "mock-auth-context.tsx");
      }
      if (source.startsWith(apiClientPath)) {
        return path.join(mocksDir, "mock-api-client.ts");
      }
      return null;
    },
  };
}

export default defineConfig({
  output: "static",
  integrations: [react(), mdx()],
  vite: {
    plugins: [tailwindcss(), mockViewerDeps()],
    resolve: {
      alias: {
        "@viewer": viewerSrc,
      },
    },
  },
});
