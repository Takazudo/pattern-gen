import { useState } from 'react';
import { FontExplorerModal } from './font-explorer-modal.js';

const CURATED_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Poppins',
  'Raleway',
  'Oswald',
  'Merriweather',
  'Playfair Display',
  'Source Code Pro',
  'Noto Sans',
  'Noto Sans JP',
  'Ubuntu',
  'Nunito',
  'Quicksand',
  'Bebas Neue',
  'Pacifico',
  'Archivo Black',
];

const EXTENDED_FONTS = [
  'ABeeZee',
  'Abel',
  'Abril Fatface',
  'Acme',
  'Alegreya',
  'Alegreya Sans',
  'Alfa Slab One',
  'Amatic SC',
  'Amiri',
  'Anton',
  'Archivo',
  'Archivo Narrow',
  'Arimo',
  'Arvo',
  'Asap',
  'Assistant',
  'Barlow',
  'Barlow Condensed',
  'Barlow Semi Condensed',
  'Be Vietnam Pro',
  'Bitter',
  'Black Ops One',
  'Bodoni Moda',
  'Bree Serif',
  'Cabin',
  'Cairo',
  'Catamaran',
  'Caveat',
  'Chakra Petch',
  'Cinzel',
  'Comfortaa',
  'Commissioner',
  'Cormorant Garamond',
  'Crimson Text',
  'DM Mono',
  'DM Sans',
  'DM Serif Display',
  'Dancing Script',
  'Domine',
  'Dosis',
  'EB Garamond',
  'Encode Sans',
  'Exo',
  'Exo 2',
  'Fira Code',
  'Fira Sans',
  'Fira Sans Condensed',
  'Fjalla One',
  'Fredoka',
  'Geologica',
  'Gloria Hallelujah',
  'Gothic A1',
  'Great Vibes',
  'Heebo',
  'Hind',
  'IBM Plex Mono',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Inconsolata',
  'Indie Flower',
  'Jost',
  'Josefin Sans',
  'Josefin Slab',
  'Kalam',
  'Kanit',
  'Karla',
  'Khand',
  'Lexend',
  'Libre Baskerville',
  'Libre Franklin',
  'Lilita One',
  'Lobster',
  'Lobster Two',
  'Lora',
  'M PLUS Rounded 1c',
  'Manrope',
  'Maven Pro',
  'Merriweather Sans',
  'Mukta',
  'Mulish',
  'Nanum Gothic',
  'Nanum Myeongjo',
  'Neuton',
  'Noticia Text',
  'Noto Serif',
  'Noto Serif JP',
  'Outfit',
  'Overpass',
  'Oxygen',
  'PT Sans',
  'PT Sans Narrow',
  'PT Serif',
  'Pathway Extreme',
  'Permanent Marker',
  'Philosopher',
  'Play',
  'Plus Jakarta Sans',
  'Pridi',
  'Prompt',
  'Public Sans',
  'Quattrocento Sans',
  'Rajdhani',
  'Red Hat Display',
  'Roboto Condensed',
  'Roboto Mono',
  'Roboto Slab',
  'Rokkitt',
  'Rubik',
  'Russo One',
  'Saira',
  'Sarabun',
  'Satisfy',
  'Shadows Into Light',
  'Signika',
  'Slabo 27px',
  'Source Sans 3',
  'Source Serif 4',
  'Space Grotesk',
  'Space Mono',
  'Spectral',
  'Teko',
  'Titillium Web',
  'Ubuntu Mono',
  'Urbanist',
  'Varela Round',
  'Vollkorn',
  'Work Sans',
  'Yanone Kaffeesatz',
  'Yellowtail',
  'Zen Kaku Gothic New',
  'Zilla Slab',
];

const fontLoadPromises = new Map<string, Promise<void>>();
const loadedFonts = new Set<string>();

const FONT_LOAD_TIMEOUT_MS = 10000;

export function isFontLoaded(family: string): boolean {
  return loadedFonts.has(family);
}

export function loadGoogleFont(family: string): Promise<void> {
  const existing = fontLoadPromises.get(family);
  if (existing) return existing;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  document.head.appendChild(link);

  // Wait for the stylesheet to load so @font-face rules are registered,
  // then wait for the actual font binary to be ready.
  const stylesheetLoaded = new Promise<void>((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
  });
  const fontReady = stylesheetLoaded
    .then(() => document.fonts.load(`400 1em "${family}"`))
    .then(() => {});
  const timeout = new Promise<void>((resolve) =>
    setTimeout(resolve, FONT_LOAD_TIMEOUT_MS),
  );
  const promise = Promise.race([fontReady, timeout]).then(() => {
    loadedFonts.add(family);
  });
  fontLoadPromises.set(family, promise);
  return promise;
}

interface FontPickerProps {
  id?: string;
  value: string;
  onChange: (family: string) => void;
}

export function ComposerFontPicker({ id, value, onChange }: FontPickerProps) {
  const [showMore, setShowMore] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [search, setSearch] = useState('');

  const allFonts = showMore
    ? [...CURATED_FONTS, ...EXTENDED_FONTS]
    : CURATED_FONTS;
  const filtered = showMore
    ? allFonts.filter((f) =>
        f.toLowerCase().includes(search.toLowerCase()),
      )
    : allFonts;

  return (
    <div className="composer-font-picker">
      {!showMore ? (
        <>
          <select
            id={id}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
          >
            {CURATED_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            {!CURATED_FONTS.includes(value) && (
              <option value={value}>{value}</option>
            )}
          </select>
          <div className="composer-font-btn-row">
            <button
              className="btn composer-font-more-btn"
              onClick={() => setShowMore(true)}
            >
              More...
            </button>
            <button
              className="btn composer-font-explore-btn"
              onClick={() => setShowExplorer(true)}
            >
              Explore
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            id={id}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fonts..."
            className="composer-font-search"
          />
          <div className="composer-font-list">
            {filtered.slice(0, 50).map((f) => (
              <button
                key={f}
                className={`composer-font-item ${f === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(f);
                  setShowMore(false);
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="composer-font-btn-row">
            <button className="btn" onClick={() => setShowMore(false)}>
              Back
            </button>
            <button
              className="btn composer-font-explore-btn"
              onClick={() => setShowExplorer(true)}
            >
              Explore
            </button>
          </div>
        </>
      )}
      {showExplorer && (
        <FontExplorerModal
          onSelect={(family) => {
            onChange(family);
            setShowMore(false);
          }}
          onClose={() => setShowExplorer(false)}
        />
      )}
    </div>
  );
}
