import { useState, useCallback } from 'react';
import { VariantPreview } from './variant-preview';
import { humanize } from './preview-utils';

interface VariantTabsProps {
  variants: string[];
  baseUrl: string;
  controls?: string;
}

export function VariantTabs({ variants, baseUrl, controls }: VariantTabsProps) {
  const [selected, setSelected] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let next = selected;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        next = (selected + 1) % variants.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        next = (selected - 1 + variants.length) % variants.length;
      } else if (e.key === 'Home') {
        next = 0;
      } else if (e.key === 'End') {
        next = variants.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      setSelected(next);
      // Focus the new tab button
      const tablist = e.currentTarget;
      const buttons = tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[next]?.focus();
    },
    [selected, variants.length],
  );

  if (variants.length === 0) return null;

  const variantName = variants[selected];
  const src = `${baseUrl}/${variantName}`;
  const panelId = 'variant-panel';

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex gap-hsp-sm border-b border-muted mb-vsp-sm overflow-x-auto"
        role="tablist"
        aria-label="Variant selector"
        onKeyDown={handleKeyDown}
      >
        {variants.map((name, i) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={i === selected}
            aria-controls={panelId}
            tabIndex={i === selected ? 0 : -1}
            className={`px-hsp-xs py-vsp-3xs text-sm whitespace-nowrap border-b-2 transition-colors duration-150 cursor-pointer ${
              i === selected
                ? 'text-fg font-semibold border-accent'
                : 'text-muted border-transparent hover:text-fg'
            }`}
            onClick={() => setSelected(i)}
          >
            {humanize(name)}
          </button>
        ))}
      </div>

      {/* Single preview — key forces remount on variant change */}
      <div id={panelId} role="tabpanel" aria-label={humanize(variantName)}>
        <VariantPreview key={variantName} src={src} name={variantName} controls={controls} />
      </div>
    </div>
  );
}
