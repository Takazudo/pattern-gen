import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { loadGoogleFont, isFontLoaded } from './composer-font-picker.js';
import { useAuth } from '../contexts/auth-context.js';
import { useFontFavorites } from '../hooks/use-font-favorites.js';
import catalogData from '../data/google-fonts-catalog.json';
import type {
  GoogleFontEntry,
  FontCategory,
} from '../data/google-fonts-types.js';
import {
  FONT_CATEGORIES,
  CATEGORY_LABELS,
} from '../data/google-fonts-types.js';
import './font-explorer-modal.css';

const catalog = catalogData as GoogleFontEntry[];

const PAGE_SIZE = 60;

interface FontExplorerModalProps {
  onSelect: (family: string) => void;
  onClose: () => void;
}

export function FontExplorerModal({ onSelect, onClose }: FontExplorerModalProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<FontCategory | null>(null);
  const [previewText, setPreviewText] = useState('The quick brown fox');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite, favorites } = useFontFavorites();

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filter fonts, sort favorites first
  const filtered = useMemo(() => {
    let result = catalog;
    if (activeCategory) {
      result = result.filter((f) => f.category === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.family.toLowerCase().includes(q));
    }
    if (favorites.size > 0) {
      const favs = result.filter((f) => favorites.has(f.family));
      const rest = result.filter((f) => !favorites.has(f.family));
      result = [...favs, ...rest];
    }
    return result;
  }, [search, activeCategory, favorites]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    gridRef.current?.scrollTo(0, 0);
  }, [search, activeCategory]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  const handleShowMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  const handleSelect = useCallback(
    (family: string) => {
      onSelect(family);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div className="font-explorer-overlay" onClick={onClose}>
      <div
        className="font-explorer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="font-explorer-header">
          <input
            ref={searchRef}
            type="text"
            className="font-explorer-search"
            placeholder="Search fonts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn font-explorer-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Filter bar + result count */}
        <div className="font-explorer-filters">
          <div className="font-explorer-category-bar">
            <button
              className={`btn font-explorer-cat-btn ${activeCategory === null ? 'active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              All
            </button>
            {FONT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`btn font-explorer-cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() =>
                  setActiveCategory(activeCategory === cat ? null : cat)
                }
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <div className="font-explorer-count">
            {filtered.length === catalog.length
              ? `${catalog.length} families`
              : `${filtered.length} of ${catalog.length} families`}
          </div>
        </div>

        {/* Preview text input */}
        <div className="font-explorer-preview-bar">
          <label className="font-explorer-preview-label">Preview:</label>
          <input
            type="text"
            className="font-explorer-preview-input"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Type preview text..."
          />
        </div>

        {/* Font grid */}
        <div className="font-explorer-grid-container" ref={gridRef}>
          {filtered.length === 0 ? (
            <div className="font-explorer-empty">
              No fonts match your search.
            </div>
          ) : (
            <>
              <div className="font-explorer-grid">
                {displayed.map((font) => (
                  <FontCard
                    key={font.family}
                    font={font}
                    previewText={previewText}
                    onClick={handleSelect}
                    showStar={isAuthenticated}
                    starred={isFavorite(font.family)}
                    onToggleStar={toggleFavorite}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  className="btn font-explorer-show-more"
                  onClick={handleShowMore}
                >
                  Show more ({filtered.length - displayCount} remaining)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Font Card ── */

function FontCard({
  font,
  previewText,
  onClick,
  showStar,
  starred,
  onToggleStar,
}: {
  font: GoogleFontEntry;
  previewText: string;
  onClick: (family: string) => void;
  showStar: boolean;
  starred: boolean;
  onToggleStar: (family: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(() => isFontLoaded(font.family));

  // Lazy-load font via IntersectionObserver
  useEffect(() => {
    if (loaded) return;
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          loadGoogleFont(font.family).then(() => setLoaded(true));
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [font.family, loaded]);

  const variantCount = font.variants.length;
  const text = previewText || font.family;

  return (
    <div
      ref={cardRef}
      className="font-explorer-card"
      onClick={() => onClick(font.family)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(font.family);
        }
      }}
    >
      <div className="font-explorer-card-header">
        <span className="font-explorer-card-name">{font.family}</span>
        <div className="font-explorer-card-header-right">
          {showStar && (
            <button
              className="font-explorer-card-star"
              onClick={(e) => { e.stopPropagation(); onToggleStar(font.family); }}
              title={starred ? 'Remove from favorites' : 'Add to favorites'}
            >
              {starred ? '\u2605' : '\u2606'}
            </button>
          )}
          <span className="font-explorer-card-meta">
            {variantCount} {variantCount === 1 ? 'style' : 'styles'}
          </span>
        </div>
      </div>
      <div className="font-explorer-card-tag">
        {CATEGORY_LABELS[font.category]}
      </div>
      <div
        className={`font-explorer-card-preview ${loaded ? '' : 'loading'}`}
        style={loaded ? { fontFamily: `"${font.family}", sans-serif` } : undefined}
      >
        {loaded ? text : (
          <span className="font-explorer-card-skeleton" />
        )}
      </div>
    </div>
  );
}
