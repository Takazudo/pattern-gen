import { useState, useEffect, useCallback, useRef } from 'react';
import './ogp-selection-overlay.css';

const OGP_ASPECT = 1200 / 630;
const MIN_WIDTH = 100;

interface OgpSelectionOverlayProps {
  /** Callback when user clicks Generate or presses Enter */
  onGenerate: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  /** Callback when user presses Escape or clicks Exit */
  onExit: () => void;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HandleDef {
  id: HandleId;
  cursor: string;
  getPos: (r: Rect) => { left: number; top: number };
}

const HANDLES: HandleDef[] = [
  {
    id: 'nw',
    cursor: 'nw-resize',
    getPos: (r) => ({ left: r.x, top: r.y }),
  },
  {
    id: 'n',
    cursor: 'n-resize',
    getPos: (r) => ({ left: r.x + r.width / 2, top: r.y }),
  },
  {
    id: 'ne',
    cursor: 'ne-resize',
    getPos: (r) => ({ left: r.x + r.width, top: r.y }),
  },
  {
    id: 'e',
    cursor: 'e-resize',
    getPos: (r) => ({ left: r.x + r.width, top: r.y + r.height / 2 }),
  },
  {
    id: 'se',
    cursor: 'se-resize',
    getPos: (r) => ({ left: r.x + r.width, top: r.y + r.height }),
  },
  {
    id: 's',
    cursor: 's-resize',
    getPos: (r) => ({ left: r.x + r.width / 2, top: r.y + r.height }),
  },
  {
    id: 'sw',
    cursor: 'sw-resize',
    getPos: (r) => ({ left: r.x, top: r.y + r.height }),
  },
  {
    id: 'w',
    cursor: 'w-resize',
    getPos: (r) => ({ left: r.x, top: r.y + r.height / 2 }),
  },
];

function clampRect(rect: Rect): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let { x, y, width, height } = rect;

  if (width < MIN_WIDTH) {
    width = MIN_WIDTH;
    height = width / OGP_ASPECT;
  }

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > vw) x = vw - width;
  if (y + height > vh) y = vh - height;

  return { x, y, width, height };
}

function getInitialRect(): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = vw * 0.6;
  const height = width / OGP_ASPECT;
  const x = (vw - width) / 2;
  const y = (vh - height) / 2;
  return clampRect({ x, y, width, height });
}

function resizeFromHandle(
  handle: HandleId,
  sr: Rect,
  dx: number,
  dy: number,
): Rect {
  switch (handle) {
    case 'se': {
      let w = sr.width + dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / OGP_ASPECT;
      return { x: sr.x, y: sr.y, width: w, height: h };
    }
    case 'sw': {
      let w = sr.width - dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / OGP_ASPECT;
      return { x: sr.x + sr.width - w, y: sr.y, width: w, height: h };
    }
    case 'ne': {
      let w = sr.width + dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / OGP_ASPECT;
      return {
        x: sr.x,
        y: sr.y + sr.height - h,
        width: w,
        height: h,
      };
    }
    case 'nw': {
      let w = sr.width - dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / OGP_ASPECT;
      return {
        x: sr.x + sr.width - w,
        y: sr.y + sr.height - h,
        width: w,
        height: h,
      };
    }
    case 'e': {
      let w = sr.width + dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / OGP_ASPECT;
      const centerY = sr.y + sr.height / 2;
      return { x: sr.x, y: centerY - h / 2, width: w, height: h };
    }
    case 'w': {
      let w = sr.width - dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / OGP_ASPECT;
      const centerY = sr.y + sr.height / 2;
      return {
        x: sr.x + sr.width - w,
        y: centerY - h / 2,
        width: w,
        height: h,
      };
    }
    case 's': {
      let h = sr.height + dy;
      let w = h * OGP_ASPECT;
      if (w < MIN_WIDTH) {
        w = MIN_WIDTH;
        h = w / OGP_ASPECT;
      }
      const centerX = sr.x + sr.width / 2;
      return { x: centerX - w / 2, y: sr.y, width: w, height: h };
    }
    case 'n': {
      let h = sr.height - dy;
      let w = h * OGP_ASPECT;
      if (w < MIN_WIDTH) {
        w = MIN_WIDTH;
        h = w / OGP_ASPECT;
      }
      const centerX = sr.x + sr.width / 2;
      return {
        x: centerX - w / 2,
        y: sr.y + sr.height - h,
        width: w,
        height: h,
      };
    }
  }
}

export function OgpSelectionOverlay({
  onGenerate,
  onExit,
}: OgpSelectionOverlayProps) {
  const [rect, setRect] = useState<Rect>(getInitialRect);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const dragRef = useRef<{
    type: 'move' | 'resize';
    handle?: HandleId;
    startMouseX: number;
    startMouseY: number;
    startRect: Rect;
  } | null>(null);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onGenerate(rectRef.current);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGenerate, onExit]);

  // Global mouse move/up for drag operations
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();

      const dx = e.clientX - drag.startMouseX;
      const dy = e.clientY - drag.startMouseY;
      const sr = drag.startRect;

      if (drag.type === 'move') {
        setRect(
          clampRect({
            x: sr.x + dx,
            y: sr.y + dy,
            width: sr.width,
            height: sr.height,
          }),
        );
        return;
      }

      setRect(clampRect(resizeFromHandle(drag.handle!, sr, dx, dy)));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMoveStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        type: 'move',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startRect: { ...rect },
      };
    },
    [rect],
  );

  const handleResizeStart = useCallback(
    (handle: HandleId, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        type: 'resize',
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startRect: { ...rect },
      };
    },
    [rect],
  );

  const { x, y, width, height } = rect;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Position action bar below selection, or at bottom of screen if no room
  const barTopRaw = y + height + 12;
  const barTop = Math.min(barTopRaw, vh - 52);

  return (
    <div className="ogp-overlay">
      {/* Dim regions around selection */}
      <div className="ogp-dim ogp-dim-top" style={{ height: y }} />
      <div
        className="ogp-dim ogp-dim-bottom"
        style={{ top: y + height, height: vh - y - height }}
      />
      <div
        className="ogp-dim ogp-dim-left"
        style={{ top: y, width: x, height }}
      />
      <div
        className="ogp-dim ogp-dim-right"
        style={{
          top: y,
          left: x + width,
          width: vw - x - width,
          height,
        }}
      />

      {/* Draggable selection area */}
      <div
        className="ogp-selection"
        style={{ left: x, top: y, width, height }}
        onMouseDown={handleMoveStart}
      />

      {/* 8 resize handles */}
      {HANDLES.map((h) => {
        const pos = h.getPos(rect);
        return (
          <div
            key={h.id}
            className="ogp-handle"
            style={{ left: pos.left, top: pos.top, cursor: h.cursor }}
            onMouseDown={(e) => handleResizeStart(h.id, e)}
          />
        );
      })}

      {/* Action bar */}
      <div className="ogp-action-bar" style={{ top: barTop }}>
        <button
          className="btn ogp-btn-generate"
          onClick={() => onGenerate(rect)}
        >
          Generate OGP Image
        </button>
        <button className="btn ogp-btn-exit" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}
