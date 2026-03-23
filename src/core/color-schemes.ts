/**
 * Color scheme definitions based on Ghostty terminal color schemes.
 * palette[0] is used as the background color.
 * palette[1-7] are used as foreground/fill colors for pattern elements.
 */

export type Palette = [string, string, string, string, string, string, string, string];

export interface ColorScheme {
  name: string;
  palette: Palette;
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    name: 'Default',
    palette: [
      '#2d2d2d',
      '#b5524a',
      '#5ea85e',
      '#c8a64e',
      '#737d8e',
      '#a87a96',
      '#5a8a8e',
      '#d5d5d5',
    ],
  },
  {
    name: 'Dracula',
    palette: [
      '#21222c',
      '#ff5555',
      '#50fa7b',
      '#f1fa8c',
      '#bd93f9',
      '#ff79c6',
      '#8be9fd',
      '#f8f8f2',
    ],
  },
  {
    name: 'Nord',
    palette: [
      '#3b4252',
      '#bf616a',
      '#a3be8c',
      '#ebcb8b',
      '#81a1c1',
      '#b48ead',
      '#88c0d0',
      '#e5e9f0',
    ],
  },
  {
    name: 'Catppuccin Mocha',
    palette: [
      '#45475a',
      '#f38ba8',
      '#a6e3a1',
      '#f9e2af',
      '#89b4fa',
      '#f5c2e7',
      '#94e2d5',
      '#a6adc8',
    ],
  },
  {
    name: 'Catppuccin Frappe',
    palette: [
      '#51576d',
      '#e78284',
      '#a6d189',
      '#e5c890',
      '#8caaee',
      '#f4b8e4',
      '#81c8be',
      '#a5adce',
    ],
  },
  {
    name: 'Catppuccin Macchiato',
    palette: [
      '#494d64',
      '#ed8796',
      '#a6da95',
      '#eed49f',
      '#8aadf4',
      '#f5bde6',
      '#8bd5ca',
      '#a5adcb',
    ],
  },
  {
    name: 'Catppuccin Latte',
    palette: [
      '#5c5f77',
      '#d20f39',
      '#40a02b',
      '#df8e1d',
      '#1e66f5',
      '#ea76cb',
      '#179299',
      '#acb0be',
    ],
  },
  {
    name: 'Gruvbox Dark',
    palette: [
      '#282828',
      '#cc241d',
      '#98971a',
      '#d79921',
      '#458588',
      '#b16286',
      '#689d6a',
      '#a89984',
    ],
  },
  {
    name: 'Gruvbox Light',
    palette: [
      '#fbf1c7',
      '#cc241d',
      '#98971a',
      '#d79921',
      '#458588',
      '#b16286',
      '#689d6a',
      '#7c6f64',
    ],
  },
  {
    name: 'TokyoNight',
    palette: [
      '#15161e',
      '#f7768e',
      '#9ece6a',
      '#e0af68',
      '#7aa2f7',
      '#bb9af7',
      '#7dcfff',
      '#a9b1d6',
    ],
  },
  {
    name: 'TokyoNight Storm',
    palette: [
      '#1d202f',
      '#f7768e',
      '#9ece6a',
      '#e0af68',
      '#7aa2f7',
      '#bb9af7',
      '#7dcfff',
      '#a9b1d6',
    ],
  },
  {
    name: 'Rose Pine',
    palette: [
      '#26233a',
      '#eb6f92',
      '#31748f',
      '#f6c177',
      '#9ccfd8',
      '#c4a7e7',
      '#ebbcba',
      '#e0def4',
    ],
  },
  {
    name: 'Rose Pine Moon',
    palette: [
      '#393552',
      '#eb6f92',
      '#3e8fb0',
      '#f6c177',
      '#9ccfd8',
      '#c4a7e7',
      '#ea9a97',
      '#e0def4',
    ],
  },
  {
    name: 'Rose Pine Dawn',
    palette: [
      '#f2e9e1',
      '#b4637a',
      '#286983',
      '#ea9d34',
      '#56949f',
      '#907aa9',
      '#d7827e',
      '#575279',
    ],
  },
  {
    name: 'Kanagawa Wave',
    palette: [
      '#090618',
      '#c34043',
      '#76946a',
      '#c0a36e',
      '#7e9cd8',
      '#957fb8',
      '#6a9589',
      '#c8c093',
    ],
  },
  {
    name: 'Kanagawa Dragon',
    palette: [
      '#0d0c0c',
      '#c4746e',
      '#8a9a7b',
      '#c4b28a',
      '#8ba4b0',
      '#a292a3',
      '#8ea4a2',
      '#c8c093',
    ],
  },
  {
    name: 'Monokai Pro',
    palette: [
      '#2d2a2e',
      '#ff6188',
      '#a9dc76',
      '#ffd866',
      '#fc9867',
      '#ab9df2',
      '#78dce8',
      '#fcfcfa',
    ],
  },
  {
    name: 'Monokai Classic',
    palette: [
      '#272822',
      '#f92672',
      '#a6e22e',
      '#e6db74',
      '#fd971f',
      '#ae81ff',
      '#66d9ef',
      '#fdfff1',
    ],
  },
  {
    name: 'Solarized Dark',
    palette: [
      '#073642',
      '#dc322f',
      '#859900',
      '#b58900',
      '#268bd2',
      '#d33682',
      '#2aa198',
      '#eee8d5',
    ],
  },
  {
    name: 'Solarized Light',
    palette: [
      '#073642',
      '#dc322f',
      '#859900',
      '#b58900',
      '#268bd2',
      '#d33682',
      '#2aa198',
      '#bbb5a2',
    ],
  },
  {
    name: 'One Half Dark',
    palette: [
      '#282c34',
      '#e06c75',
      '#98c379',
      '#e5c07b',
      '#61afef',
      '#c678dd',
      '#56b6c2',
      '#dcdfe4',
    ],
  },
  {
    name: 'Atom One Dark',
    palette: [
      '#21252b',
      '#e06c75',
      '#98c379',
      '#e5c07b',
      '#61afef',
      '#c678dd',
      '#56b6c2',
      '#abb2bf',
    ],
  },
  {
    name: 'Snazzy',
    palette: [
      '#000000',
      '#fc4346',
      '#50fb7c',
      '#f0fb8c',
      '#49baff',
      '#fc4cb4',
      '#8be9fe',
      '#ededec',
    ],
  },
  {
    name: 'Night Owl',
    palette: [
      '#011627',
      '#ef5350',
      '#22da6e',
      '#addb67',
      '#82aaff',
      '#c792ea',
      '#21c7a8',
      '#ffffff',
    ],
  },
  {
    name: 'Everforest Dark Hard',
    palette: [
      '#7a8478',
      '#e67e80',
      '#a7c080',
      '#dbbc7f',
      '#7fbbb3',
      '#d699b6',
      '#83c092',
      '#f2efdf',
    ],
  },
  {
    name: 'Material Ocean',
    palette: [
      '#546e7a',
      '#ff5370',
      '#c3e88d',
      '#ffcb6b',
      '#82aaff',
      '#c792ea',
      '#89ddff',
      '#ffffff',
    ],
  },
  {
    name: 'Horizon',
    palette: [
      '#000000',
      '#e95678',
      '#29d398',
      '#fab795',
      '#26bbd9',
      '#ee64ac',
      '#59e1e3',
      '#e5e5e5',
    ],
  },
  {
    name: 'Nightfox',
    palette: [
      '#393b44',
      '#c94f6d',
      '#81b29a',
      '#dbc074',
      '#719cd6',
      '#9d79d6',
      '#63cdcf',
      '#dfdfe0',
    ],
  },
  {
    name: 'Zenburn',
    palette: [
      '#4d4d4d',
      '#7d5d5d',
      '#60b48a',
      '#f0dfaf',
      '#5d6d7d',
      '#dc8cc3',
      '#8cd0d3',
      '#dcdccc',
    ],
  },
  {
    name: 'Ayu',
    palette: [
      '#11151c',
      '#ea6c73',
      '#7fd962',
      '#f9af4f',
      '#53bdfa',
      '#cda1fa',
      '#90e1c6',
      '#c7c7c7',
    ],
  },
  {
    name: 'Ayu Mirage',
    palette: [
      '#171b24',
      '#ed8274',
      '#87d96c',
      '#facc6e',
      '#6dcbfa',
      '#dabafa',
      '#90e1c6',
      '#c7c7c7',
    ],
  },
  {
    name: 'GitHub Dark',
    palette: [
      '#000000',
      '#f78166',
      '#56d364',
      '#e3b341',
      '#6ca4f8',
      '#db61a2',
      '#2b7489',
      '#ffffff',
    ],
  },
  {
    name: 'Adwaita Dark',
    palette: [
      '#241f31',
      '#c01c28',
      '#2ec27e',
      '#f5c211',
      '#1e78e4',
      '#9841bb',
      '#0ab9dc',
      '#c0bfbc',
    ],
  },
  {
    name: 'Tomorrow Night Eighties',
    palette: [
      '#000000',
      '#f2777a',
      '#99cc99',
      '#ffcc66',
      '#6699cc',
      '#cc99cc',
      '#66cccc',
      '#ffffff',
    ],
  },
  {
    name: 'Iceberg Dark',
    palette: [
      '#1e2132',
      '#e27878',
      '#b4be82',
      '#e2a478',
      '#84a0c6',
      '#a093c7',
      '#89b8c2',
      '#c6c8d1',
    ],
  },
  {
    name: 'Zenwritten Dark',
    palette: [
      '#191919',
      '#de6e7c',
      '#819b69',
      '#b77e64',
      '#6099c0',
      '#b279a7',
      '#66a5ad',
      '#bbbbbb',
    ],
  },
];

/** Normalize a color scheme name for case-insensitive, space/hyphen-tolerant lookup */
export function normalizeSchemeKey(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-');
}

/** Map of normalized keys to color schemes for fast lookup */
export const colorSchemesByKey: Map<string, ColorScheme> = new Map(
  COLOR_SCHEMES.map((scheme) => [normalizeSchemeKey(scheme.name), scheme]),
);

/** Get display names of all available color schemes */
export function getColorSchemeNames(): string[] {
  return COLOR_SCHEMES.map((scheme) => scheme.name);
}
