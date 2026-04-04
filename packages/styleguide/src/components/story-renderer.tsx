import { useState, useEffect, createElement, type ComponentType } from 'react';
import type { SerializableStoryEntry } from '../data/stories';
import { resolveStoryBySlug } from '../data/stories';

interface StoryRendererProps {
  entry: SerializableStoryEntry;
}

interface VariantInfo {
  name: string;
  Component: ComponentType;
}

export function StoryRenderer({ entry }: StoryRendererProps) {
  const [variants, setVariants] = useState<VariantInfo[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [title, setTitle] = useState(entry.name);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolveStoryBySlug(entry.slug).then((result) => {
      if (cancelled || !result) return;
      const { meta, variants: vs } = result;
      const displayTitle = meta.title.includes('/')
        ? meta.title.split('/').slice(1).join('/')
        : meta.title;
      setTitle(displayTitle);
      setVariants(vs.map((v) => ({ name: v.name, Component: v.render as ComponentType })));
      setActiveVariant(0);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entry.slug]);

  if (loading) {
    return <div style={{ color: 'var(--color-fg-muted)' }}>Loading story...</div>;
  }

  if (variants.length === 0) {
    return <div style={{ color: 'var(--color-fg-muted)' }}>No variants exported.</div>;
  }

  const current = variants[activeVariant];

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
        {current && createElement(current.Component, { key: current.name })}
      </div>
    </div>
  );
}
