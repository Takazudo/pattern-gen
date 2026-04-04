import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { transformerMetaHighlight, transformerMetaWordHighlight } from '@shikijs/transformers';
import tailwindcss from '@tailwindcss/vite';
import { colorSchemes } from './src/config/color-schemes';
import { settings } from './src/config/settings';
import { searchIndexIntegration } from './src/integrations/search-index';
import { devSavePlugin } from './src/plugins/vite-plugin-dev-save';
import remarkDirective from 'remark-directive';
import { remarkAdmonitions } from './src/plugins/remark-admonitions';
import { remarkResolveMarkdownLinks } from './src/plugins/remark-resolve-markdown-links';
import { rehypeCodeTitle } from './src/plugins/rehype-code-title';
import { rehypeHeadingLinks } from './src/plugins/rehype-heading-links';
import { rehypeStripMdExtension } from './src/plugins/rehype-strip-md-extension';
import type { Plugin } from 'vite';

const activeScheme = colorSchemes[settings.colorScheme];
const shikiTheme = activeScheme?.shikiTheme ?? 'vitesse-dark';

const shikiTransformers = [transformerMetaHighlight(), transformerMetaWordHighlight()];

const shikiConfig = {
  theme: shikiTheme,
  transformers: shikiTransformers,
};

const viewerSrc = fileURLToPath(
  new URL('../pattern-gen-viewer/src', import.meta.url),
);
const mocksDir = fileURLToPath(new URL('./src/mocks', import.meta.url));

/**
 * Vite plugin that redirects viewer dependency imports to styleguide mocks.
 * This lets viewer components render in the styleguide without a real backend.
 */
function mockViewerDeps(): Plugin {
  const authContextPath = path.join(viewerSrc, 'contexts', 'auth-context');
  const apiClientPath = path.join(viewerSrc, 'lib', 'api-client');

  return {
    name: 'styleguide-mock-viewer-deps',
    enforce: 'pre',
    resolveId(source) {
      if (
        source.endsWith('/contexts/auth-context.js') ||
        source.endsWith('/contexts/auth-context')
      ) {
        return path.join(mocksDir, 'mock-auth-context.tsx');
      }
      if (
        source.endsWith('/lib/api-client.js') ||
        source.endsWith('/lib/api-client')
      ) {
        return path.join(mocksDir, 'mock-api-client.ts');
      }
      if (source.startsWith(authContextPath)) {
        return path.join(mocksDir, 'mock-auth-context.tsx');
      }
      if (source.startsWith(apiClientPath)) {
        return path.join(mocksDir, 'mock-api-client.ts');
      }
      return null;
    },
  };
}

export default defineConfig({
  output: 'static',
  trailingSlash: settings.trailingSlash ? 'always' : 'never',
  base: settings.base,
  devToolbar: { enabled: false },
  integrations: [mdx(), react(), searchIndexIntegration()],
  vite: {
    plugins: [tailwindcss(), mockViewerDeps(), devSavePlugin()],
    resolve: {
      alias: [
        {
          find: '@viewer',
          replacement: viewerSrc,
        },
        {
          find: '@components',
          replacement: fileURLToPath(
            new URL('../pattern-gen-viewer/src/components', import.meta.url),
          ),
        },
      ],
    },
  },
  markdown: {
    shikiConfig,
    remarkPlugins: [
      remarkDirective,
      remarkAdmonitions,
      [
        remarkResolveMarkdownLinks,
        {
          rootDir: fileURLToPath(new URL('.', import.meta.url)),
          docsDir: settings.docsDir,
          locales: Object.fromEntries(
            Object.entries(settings.locales).map(([code, config]) => [code, { dir: config.dir }]),
          ),
          versions: settings.versions
            ? settings.versions.map((v) => ({ slug: v.slug, docsDir: v.docsDir }))
            : false,
          base: settings.base,
          trailingSlash: settings.trailingSlash,
          onBrokenLinks: settings.onBrokenMarkdownLinks,
        },
      ],
    ],
    rehypePlugins: [rehypeCodeTitle, rehypeHeadingLinks, rehypeStripMdExtension],
  },
});
