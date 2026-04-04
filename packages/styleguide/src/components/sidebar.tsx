import { useState } from 'react';
import type { SerializableCategoryGroup } from '../data/stories';

interface SidebarProps {
  categories: SerializableCategoryGroup[];
  currentSlug?: string;
}

export function Sidebar({ categories, currentSlug }: SidebarProps) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? categories
        .map((cat) => ({
          ...cat,
          stories: cat.stories.filter((s) =>
            s.name.toLowerCase().includes(filter.toLowerCase()),
          ),
        }))
        .filter((cat) => cat.stories.length > 0)
    : categories;

  return (
    <aside className="sg-sidebar">
      <input
        className="sg-search"
        type="text"
        placeholder="Filter stories..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {filtered.map((cat) => (
        <div key={cat.category} className="sg-category">
          <div className="sg-category-title">{cat.category}</div>
          {cat.stories.map((story) => (
            <a
              key={story.slug}
              href={`/stories/${story.slug}`}
              className="sg-story-link"
              aria-current={currentSlug === story.slug ? 'page' : undefined}
            >
              {story.name}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}
