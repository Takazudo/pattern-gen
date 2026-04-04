import { useState, useEffect, useRef, useCallback } from 'react';
import { getPopoverPosition } from '../../lib/popover-position';

export interface PaletteSelectorProps {
  label: string;
  value: number;
  palette: string[];
  onChange: (index: number) => void;
}

export default function PaletteSelector({ label, value, palette, onChange }: PaletteSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => setIsOpen(false), []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideContainer = containerRef.current && containerRef.current.contains(target);
      const insideButton = buttonRef.current && buttonRef.current.contains(target);
      if (!insideContainer && !insideButton) {
        handleClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  function select(index: number) {
    onChange(index);
    setIsOpen(false);
  }

  const resolvedColor = palette[value] ?? '#000000';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`${label}: p${value}`}
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#313244',
          color: '#cdd6f4',
          padding: '4px 6px',
          fontSize: 11,
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            flex: 1,
            textAlign: 'left',
            color: '#6c7086',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.12)',
            backgroundColor: resolvedColor,
            flexShrink: 0,
          }}
        />
        <span style={{ flexShrink: 0, width: '2em' }}>p{value}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ flexShrink: 0, color: '#6c7086' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={`${label} color options`}
          style={{
            ...getPopoverPosition(buttonRef.current, 280, 120),
            padding: 10,
            background: '#313244',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 5,
          }}
        >
          {palette.map((color, i) => {
            const isSelected = value === i;
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => select(i)}
                title={`p${i}: ${color}`}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  backgroundColor: color,
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  outline: isSelected ? '2px solid #89b4fa' : 'none',
                  outlineOffset: 1,
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.outline =
                      '2px solid rgba(255,255,255,0.3)';
                    (e.currentTarget as HTMLElement).style.outlineOffset = '1px';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.outline = 'none';
                  }
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
