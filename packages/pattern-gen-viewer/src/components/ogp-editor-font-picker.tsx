import { useState } from 'react';

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
  ...CURATED_FONTS,
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

const loadedFonts = new Set<string>();

export function loadGoogleFont(family: string): Promise<void> {
  if (loadedFonts.has(family)) return Promise.resolve();
  loadedFonts.add(family);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  document.head.appendChild(link);

  return document.fonts.ready.then(() => {});
}

interface FontPickerProps {
  value: string;
  onChange: (family: string) => void;
}

export function OgpEditorFontPicker({ value, onChange }: FontPickerProps) {
  const [showMore, setShowMore] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = showMore
    ? EXTENDED_FONTS.filter((f) =>
        f.toLowerCase().includes(search.toLowerCase()),
      )
    : CURATED_FONTS;

  return (
    <div className="ogp-font-picker">
      {!showMore ? (
        <>
          <select
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              loadGoogleFont(e.target.value);
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
          <button
            className="btn ogp-font-more-btn"
            onClick={() => setShowMore(true)}
          >
            More...
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fonts..."
            className="ogp-font-search"
          />
          <div className="ogp-font-list">
            {filtered.slice(0, 50).map((f) => (
              <button
                key={f}
                className={`ogp-font-item ${f === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(f);
                  loadGoogleFont(f);
                  setShowMore(false);
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => setShowMore(false)}>
            Back
          </button>
        </>
      )}
    </div>
  );
}
