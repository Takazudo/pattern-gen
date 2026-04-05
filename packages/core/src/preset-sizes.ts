/**
 * Preset image sizes for common platforms and use cases.
 */

export interface PresetSize {
  /** Unique identifier, e.g. 'youtube-thumbnail' */
  id: string;
  /** Platform name, e.g. 'YouTube' */
  platform: string;
  /** Use case label, e.g. 'Thumbnail' */
  label: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Grouping category */
  category: PresetSizeCategory;
}

export type PresetSizeCategory = 'social' | 'video' | 'web' | 'print';

export const PRESET_SIZE_CATEGORIES: {
  id: PresetSizeCategory;
  label: string;
}[] = [
  { id: 'social', label: 'Social' },
  { id: 'video', label: 'Video' },
  { id: 'web', label: 'Web' },
  { id: 'print', label: 'Print' },
];

export const PRESET_SIZES: PresetSize[] = [
  // ── Social ──
  {
    id: 'ogp',
    platform: 'OGP',
    label: 'Open Graph Preview',
    width: 1200,
    height: 630,
    category: 'social',
  },
  {
    id: 'twitter-post',
    platform: 'Twitter / X',
    label: 'Post Image',
    width: 1200,
    height: 675,
    category: 'social',
  },
  {
    id: 'twitter-header',
    platform: 'Twitter / X',
    label: 'Header',
    width: 1500,
    height: 500,
    category: 'social',
  },
  {
    id: 'instagram-square',
    platform: 'Instagram',
    label: 'Square Post',
    width: 1080,
    height: 1080,
    category: 'social',
  },
  {
    id: 'instagram-portrait',
    platform: 'Instagram',
    label: 'Portrait Post',
    width: 1080,
    height: 1350,
    category: 'social',
  },
  {
    id: 'instagram-story',
    platform: 'Instagram',
    label: 'Story / Reel',
    width: 1080,
    height: 1920,
    category: 'social',
  },
  {
    id: 'facebook-post',
    platform: 'Facebook',
    label: 'Post Image',
    width: 1200,
    height: 630,
    category: 'social',
  },
  {
    id: 'facebook-cover',
    platform: 'Facebook',
    label: 'Cover Photo',
    width: 820,
    height: 312,
    category: 'social',
  },
  {
    id: 'linkedin-post',
    platform: 'LinkedIn',
    label: 'Post Image',
    width: 1200,
    height: 627,
    category: 'social',
  },
  {
    id: 'linkedin-cover',
    platform: 'LinkedIn',
    label: 'Cover Photo',
    width: 1584,
    height: 396,
    category: 'social',
  },
  {
    id: 'pinterest-pin',
    platform: 'Pinterest',
    label: 'Pin',
    width: 1000,
    height: 1500,
    category: 'social',
  },

  // ── Video ──
  {
    id: 'youtube-thumbnail',
    platform: 'YouTube',
    label: 'Thumbnail',
    width: 1280,
    height: 720,
    category: 'video',
  },
  {
    id: 'youtube-banner',
    platform: 'YouTube',
    label: 'Channel Banner',
    width: 2560,
    height: 1440,
    category: 'video',
  },
  {
    id: 'twitch-offline',
    platform: 'Twitch',
    label: 'Offline Banner',
    width: 1920,
    height: 1080,
    category: 'video',
  },
  {
    id: 'twitch-panel',
    platform: 'Twitch',
    label: 'Panel',
    width: 320,
    height: 160,
    category: 'video',
  },

  // ── Web ──
  {
    id: 'web-hd',
    platform: 'Web',
    label: 'HD Banner (1920 x 1080)',
    width: 1920,
    height: 1080,
    category: 'web',
  },
  {
    id: 'web-square',
    platform: 'Web',
    label: 'Square (800 x 800)',
    width: 800,
    height: 800,
    category: 'web',
  },
  {
    id: 'web-hero',
    platform: 'Web',
    label: 'Hero (1440 x 600)',
    width: 1440,
    height: 600,
    category: 'web',
  },
  {
    id: 'web-leaderboard',
    platform: 'Web',
    label: 'Leaderboard Ad (728 x 90)',
    width: 728,
    height: 90,
    category: 'web',
  },
  {
    id: 'favicon-large',
    platform: 'Web',
    label: 'Favicon (512 x 512)',
    width: 512,
    height: 512,
    category: 'web',
  },

  // ── Print ──
  {
    id: 'a4-landscape-300',
    platform: 'Print',
    label: 'A4 Landscape (300 DPI)',
    width: 3508,
    height: 2480,
    category: 'print',
  },
  {
    id: 'a4-portrait-300',
    platform: 'Print',
    label: 'A4 Portrait (300 DPI)',
    width: 2480,
    height: 3508,
    category: 'print',
  },
  {
    id: 'us-letter-landscape',
    platform: 'Print',
    label: 'US Letter Landscape',
    width: 3300,
    height: 2550,
    category: 'print',
  },
];
