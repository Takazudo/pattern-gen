import { useMemo, useEffect, useRef } from 'react';
import { patternRegistry } from '@takazudo/pattern-gen-generators';
import { COLOR_SCHEMES } from '@takazudo/pattern-gen-core';
import { generatePreview } from '../utils/generate-on-canvas.js';
import './home-page.css';

interface TileData {
  patternType: string;
  displayName: string;
  slug: string;
  colorSchemeIndex: number;
}

function randomSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export interface HomePageProps {
  onSelectPattern: (patternType: string, slug: string, colorSchemeIndex: number) => void;
}

const TILE_SIZE = 200;
const BATCH_SIZE = 4;

export function HomePage({ onSelectPattern }: HomePageProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const placeholderRefs = useRef<(HTMLDivElement | null)[]>([]);

  const tileData = useMemo<TileData[]>(() => {
    return patternRegistry.map((pattern) => ({
      patternType: pattern.name,
      displayName: pattern.displayName,
      slug: randomSlug(),
      colorSchemeIndex: Math.floor(Math.random() * COLOR_SCHEMES.length),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idx = 0;

    function renderBatch() {
      if (cancelled || idx >= tileData.length) return;
      const end = Math.min(idx + BATCH_SIZE, tileData.length);
      for (let i = idx; i < end; i++) {
        const canvas = canvasRefs.current[i];
        if (canvas) {
          const { slug, patternType, colorSchemeIndex } = tileData[i];
          generatePreview(canvas, slug, patternType, colorSchemeIndex);
          // Mark placeholder as rendered
          const placeholder = placeholderRefs.current[i];
          if (placeholder) {
            placeholder.dataset.rendered = 'true';
          }
        }
      }
      idx = end;
      if (idx < tileData.length) {
        requestAnimationFrame(renderBatch);
      }
    }

    requestAnimationFrame(renderBatch);
    return () => {
      cancelled = true;
    };
  }, [tileData]);

  return (
    <div className="home-page">
      <div className="home-page-grid">
        {tileData.map((tile, i) => (
          <div
            key={tile.patternType}
            className="home-page-tile"
            onClick={() =>
              onSelectPattern(tile.patternType, tile.slug, tile.colorSchemeIndex)
            }
          >
            <canvas
              ref={(el) => { canvasRefs.current[i] = el; }}
              width={TILE_SIZE}
              height={TILE_SIZE}
            />
            <div
              ref={(el) => { placeholderRefs.current[i] = el; }}
              className="home-page-tile-placeholder"
            >
              {tile.displayName}
            </div>
            <div className="home-page-tile-overlay">
              <div className="home-page-tile-label">{tile.displayName}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
