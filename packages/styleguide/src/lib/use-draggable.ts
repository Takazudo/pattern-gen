import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

export function useDraggable(panelWidth: number) {
  function centerPosition(): Position {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: Math.max(0, (window.innerWidth - panelWidth) / 2),
      y: Math.max(0, (window.innerHeight - 500) / 2),
    };
  }

  const [position, setPosition] = useState<Position>(centerPosition);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const recenter = useCallback(() => {
    setPosition(centerPosition());
  }, [panelWidth]);

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      dragging.current = true;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      e.preventDefault();

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        setPosition({
          x: Math.max(
            0,
            Math.min(ev.clientX - dragOffset.current.x, window.innerWidth - panelWidth),
          ),
          y: Math.max(0, Math.min(ev.clientY - dragOffset.current.y, window.innerHeight - 100)),
        });
      };
      const onMouseUp = () => {
        dragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [position, panelWidth],
  );

  return { position, onMouseDown, recenter };
}
