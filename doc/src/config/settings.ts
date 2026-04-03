export type {
  HeaderNavChildItem,
  HeaderNavItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
} from "./settings-types";
import type {
  HeaderNavItem,
  ColorModeConfig,
  HtmlPreviewConfig,
  LocaleConfig,
  VersionConfig,
  FooterConfig,
} from "./settings-types";

export const settings = {
  colorScheme: "Default Dark",
  colorMode: {
    defaultMode: "dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    respectPrefersColorScheme: true,
  } satisfies ColorModeConfig,
  siteName: "pattern-gen",
  siteDescription: "Deterministic visual pattern generator — 30 algorithms from geometric tiles to noise-based textures" as string,
  base: "/",
  trailingSlash: false as boolean,
  noindex: false as boolean,
  editUrl: false as string | false,
  siteUrl: "" as string,
  docsDir: "src/content/docs",
  locales: {} as Record<string, LocaleConfig>,
  mermaid: false,
  sitemap: false,
  docMetainfo: false,
  docTags: false,
  llmsTxt: true,
  math: false,
  onBrokenMarkdownLinks: "warn" as "warn" | "error" | "ignore",
  aiAssistant: false as boolean,
  docHistory: false,
  colorTweakPanel: false as boolean,
  sidebarResizer: true as boolean,
  sidebarToggle: true as boolean,
  htmlPreview: undefined as HtmlPreviewConfig | undefined,
  versions: false as VersionConfig[] | false,
  claudeResources: {
    claudeDir: ".claude",
  } as { claudeDir: string; projectRoot?: string } | false,
  footer: {
    links: [
      {
        title: "Docs",
        items: [
          { label: "Getting Started", href: "/docs/getting-started" },
          { label: "CLI Reference", href: "/docs/cli" },
          { label: "API Reference", href: "/docs/api" },
        ],
      },
      {
        title: "Reference",
        items: [
          { label: "Pattern Catalog", href: "/docs/patterns" },
          { label: "Frame Catalog", href: "/docs/frames" },
          { label: "OGP Config", href: "/docs/config/ogp-config" },
          { label: "Composer Config", href: "/docs/config/composer-config" },
        ],
      },
    ],
    copyright: "Copyright © 2026 Takeshi Takatsudo. Built with zudo-doc.",
  } satisfies FooterConfig as FooterConfig | false,
  headerNav: [
    { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },
    { label: "CLI", path: "/docs/cli", categoryMatch: "cli" },
    { label: "Patterns", path: "/docs/patterns", categoryMatch: "patterns" },
    { label: "Frames", path: "/docs/frames", categoryMatch: "frames" },
    { label: "Config", path: "/docs/config/ogp-config", categoryMatch: "config" },
    { label: "API", path: "/docs/api", categoryMatch: "api" },
    { label: "Architecture", path: "/docs/architecture", categoryMatch: "architecture" },
  ] satisfies HeaderNavItem[],
};
