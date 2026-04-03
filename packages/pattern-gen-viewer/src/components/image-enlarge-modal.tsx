import { useEffect, useCallback } from 'react';

interface ImageEnlargeModalProps {
  images: { src: string; label: string }[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImageEnlargeModal({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: ImageEnlargeModalProps) {
  const current = images[currentIndex];
  const total = images.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(currentIndex + 1);
    },
    [onClose, onNavigate, currentIndex, hasPrev, hasNext],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!current) return null;

  return (
    <div className="enlarge-overlay" onClick={onClose}>
      <div className="enlarge-content" onClick={(e) => e.stopPropagation()}>
        {hasPrev && (
          <button
            className="enlarge-nav enlarge-nav-prev"
            onClick={() => onNavigate(currentIndex - 1)}
            aria-label="Previous image"
          >
            &lsaquo;
          </button>
        )}
        <img
          src={current.src}
          alt={current.label}
          className="enlarge-image"
        />
        {hasNext && (
          <button
            className="enlarge-nav enlarge-nav-next"
            onClick={() => onNavigate(currentIndex + 1)}
            aria-label="Next image"
          >
            &rsaquo;
          </button>
        )}
      </div>
      <div className="enlarge-footer">
        <span className="enlarge-counter">
          {currentIndex + 1} / {total}
        </span>
        <span className="enlarge-filename">{current.label}</span>
      </div>
    </div>
  );
}
