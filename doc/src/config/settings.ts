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
  siteName: "Doc",
  siteDescription: "" as string,
  base: "/",
  trailingSlash: false as boolean,
  noindex: false as boolean,
  editUrl: false as string | false,
  siteUrl: "" as string,
  docsDir: "src/content/docs",
  locales: {} as Record<string, LocaleConfig>,
  mermaid: true,
  d2: false,
  d2BuildMode: "wasm" as "wasm" | "cli",
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
        ],
      },
    ],
    copyright: "Copyright © 2026 Your Name. Built with zudo-doc.",
  } satisfies FooterConfig as FooterConfig | false,
  headerNav: [
    { label: "Getting Started", path: "/docs/getting-started", categoryMatch: "getting-started" },
  ] satisfies HeaderNavItem[],
};
