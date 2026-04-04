import { useState, useEffect, type ReactNode } from 'react';
import type { StoryEntry } from '../data/stories';
import { resolveStory } from '../data/stories';

interface StoryRendererProps {
  entry: StoryEntry;
}

interface VariantInfo {
  name: string;
  render: () => unknown;
}

export function StoryRenderer({ entry }: StoryRendererProps) {
  const [variants, setVariants] = useState<VariantInfo[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [title, setTitle] = useState(entry.name);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolveStory(entry).then(({ meta, variants: vs }) => {
      if (cancelled) return;
      const displayTitle = meta.title.includes('/')
        ? meta.title.split('/').slice(1).join('/')
        : meta.title;
      setTitle(displayTitle);
      setVariants(vs);
      setActiveVariant(0);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entry]);

  if (loading) {
    return <div style={{ color: 'var(--color-fg-muted)' }}>Loading story...</div>;
  }

  if (variants.length === 0) {
    return <div style={{ color: 'var(--color-fg-muted)' }}>No variants exported.</div>;
  }

  const current = variants[activeVariant];
  const rendered = current?.render();

  return (
    <div>
      <h1 className="sg-story-title">{title}</h1>

      {variants.length > 1 && (
        <div className="sg-variant-tabs">
          {variants.map((v, i) => (
            <button
              key={v.name}
              className={`sg-variant-tab${i === activeVariant ? ' active' : ''}`}
              onClick={() => setActiveVariant(i)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      <div className="sg-variant-preview">
        {rendered as ReactNode}
      </div>
    </div>
  );
}
