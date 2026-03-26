import { useState, useEffect, useCallback, useRef } from 'react';
import { OGP_WIDTH, OGP_HEIGHT } from 'pattern-gen/core/ogp-config';
import './ogp-selection-overlay.css';

const OGP_ASPECT = OGP_WIDTH / OGP_HEIGHT;
const MIN_WIDTH = 100;

export interface OgpRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OgpSelectionOverlayProps {
  /** Callback when user clicks Generate or presses Enter */
  onGenerate: (rect: OgpRect) => void;
  /** Callback when user presses Escape or clicks Exit */
  onExit: () => void;
  /** Callback to download OGP config as JSON file */
  onDownloadJson: (rect: OgpRect) => void;
  /** Callback to copy OGP config JSON to clipboard; resolves on success */
  onCopyJson: (rect: OgpRect) => Promise<void>;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type DragState =
  | { type: 'move'; startMouseX: number; startMouseY: number; startRect: OgpRect }
  | { type: 'resize'; handle: HandleId; startMouseX: number; startMouseY: number; startRect: OgpRect };

interface HandleDef {
  id: HandleId;
  cursor: string;
  getPos: (r: OgpRect) => { left: number; top: number };
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

function clampRect(rect: OgpRect): OgpRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let { x, y, width, height } = rect;

  if (width < MIN_WIDTH) {
    width = MIN_WIDTH;
    height = width / OGP_ASPECT;
  }

  // Cap dimensions to fit within viewport (both axes must satisfy)
  const maxW = Math.min(vw, vh * OGP_ASPECT);
  const maxH = maxW / OGP_ASPECT;
  if (width > maxW) {
    width = maxW;
    height = maxH;
  }

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > vw) x = vw - width;
  if (y + height > vh) y = vh - height;

  return { x, y, width, height };
}

function getInitialRect(): OgpRect {
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
  sr: OgpRect,
  dx: number,
  dy: number,
): OgpRect {
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
    default: {
      const _exhaustive: never = handle;
      return _exhaustive;
    }
  }
}

export function OgpSelectionOverlay({
  onGenerate,
  onExit,
  onDownloadJson,
  onCopyJson,
}: OgpSelectionOverlayProps) {
  const [rect, setRect] = useState<OgpRect>(getInitialRect);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const dragRef = useRef<DragState | null>(null);

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

      if (drag.type === 'resize') {
        setRect(clampRect(resizeFromHandle(drag.handle, sr, dx, dy)));
      }
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

  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleCopy = useCallback((r: OgpRect) => {
    onCopyJson(r).then(() => {
      setCopyFeedback(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyFeedback(false), 1500);
    }).catch(() => { /* clipboard denied */ });
  }, [onCopyJson]);

  const handleMoveStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        type: 'move',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startRect: { ...rectRef.current },
      };
    },
    [],
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
        startRect: { ...rectRef.current },
      };
    },
    [],
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
        <button className="btn ogp-btn-json" onClick={() => onDownloadJson(rect)}>
          Download JSON
        </button>
        <button className="btn ogp-btn-json" onClick={() => handleCopy(rect)}>
          {copyFeedback ? 'Copied!' : 'Copy JSON'}
        </button>
        <button className="btn ogp-btn-exit" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}
