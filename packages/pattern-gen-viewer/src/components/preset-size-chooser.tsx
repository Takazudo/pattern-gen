import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PRESET_SIZES,
  PRESET_SIZE_CATEGORIES,
} from '@takazudo/pattern-gen-core';
import type { PresetSize, PresetSizeCategory } from '@takazudo/pattern-gen-core';
import './preset-size-chooser.css';

const MAX_PREVIEW_HEIGHT = 52;
const MAX_PREVIEW_WIDTH = 80;

function getAspectBoxSize(width: number, height: number) {
  const aspect = width / height;
  if (aspect >= 1) {
    const w = MAX_PREVIEW_WIDTH;
    const h = w / aspect;
    return { width: w, height: Math.max(h, 4) };
  }
  const h = MAX_PREVIEW_HEIGHT;
  const w = h * aspect;
  return { width: Math.max(w, 4), height: h };
}

interface PresetSizeChooserProps {
  onSelect: (preset: PresetSize) => void;
  onClose: () => void;
}

export function PresetSizeChooser({ onSelect, onClose }: PresetSizeChooserProps) {
  const [activeCategory, setActiveCategory] = useState<PresetSizeCategory | null>(null);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!activeCategory) return PRESET_SIZES;
    return PRESET_SIZES.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  // Group by category for display
  const grouped = useMemo(() => {
    const groups: { category: PresetSizeCategory; label: string; items: PresetSize[] }[] = [];
    for (const cat of PRESET_SIZE_CATEGORIES) {
      const items = filtered.filter((p) => p.category === cat.id);
      if (items.length > 0) {
        groups.push({ category: cat.id, label: cat.label, items });
      }
    }
    return groups;
  }, [filtered]);

  const handleSelect = useCallback(
    (preset: PresetSize) => {
      onSelect(preset);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div className="preset-size-overlay" onClick={onClose}>
      <div
        className="preset-size-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="preset-size-header">
          <span className="preset-size-title">Preset Sizes</span>
          <button
            className="btn preset-size-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Category tabs */}
        <div className="preset-size-tabs">
          <button
            className={`btn preset-size-tab-btn ${activeCategory === null ? 'active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {PRESET_SIZE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`btn preset-size-tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() =>
                setActiveCategory(activeCategory === cat.id ? null : cat.id)
              }
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="preset-size-grid-container">
          {grouped.length === 0 ? (
            <div className="preset-size-empty">No presets found.</div>
          ) : (
            grouped.map((group) => (
              <div key={group.category}>
                <div className="preset-size-category-heading">{group.label}</div>
                <div className="preset-size-grid">
                  {group.items.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      onClick={handleSelect}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Preset Card ── */

function PresetCard({
  preset,
  onClick,
}: {
  preset: PresetSize;
  onClick: (preset: PresetSize) => void;
}) {
  const boxSize = getAspectBoxSize(preset.width, preset.height);

  return (
    <div
      className="preset-size-card"
      onClick={() => onClick(preset)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(preset);
        }
      }}
    >
      {/* Aspect ratio preview */}
      <div className="preset-size-aspect-preview">
        <div
          className="preset-size-aspect-box"
          style={{ width: boxSize.width, height: boxSize.height }}
        />
      </div>

      {/* Info */}
      <div className="preset-size-card-header">
        <span className="preset-size-card-label">{preset.label}</span>
        <span className="preset-size-card-star" title="Favorite (coming soon)">
          &#x2606;
        </span>
      </div>
      <div className="preset-size-card-platform">{preset.platform}</div>
      <div className="preset-size-card-dims">
        {preset.width} &times; {preset.height}
      </div>
    </div>
  );
}
