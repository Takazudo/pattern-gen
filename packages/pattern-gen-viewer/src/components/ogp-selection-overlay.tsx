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

export type AspectMode = 'ogp' | 'square' | 'free' | 'fixed';

export interface AspectConfig {
  mode: AspectMode;
  freeW: number;
  freeH: number;
  fixedW: number;
  fixedH: number;
}

function getAspect(config: AspectConfig): number {
  switch (config.mode) {
    case 'ogp': return OGP_ASPECT;
    case 'square': return 1;
    case 'free': return (config.freeW / config.freeH) || 1;
    case 'fixed': return (config.fixedW / config.fixedH) || 1;
  }
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
  /** Callback to enter the OGP editor with current selection */
  onEdit: (rect: OgpRect) => void;
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

function clampRect(rect: OgpRect, aspect: number): OgpRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let { x, y, width, height } = rect;

  if (width < MIN_WIDTH) {
    width = MIN_WIDTH;
    height = width / aspect;
  }

  // Cap dimensions to fit within viewport (both axes must satisfy)
  const maxW = Math.min(vw, vh * aspect);
  const maxH = maxW / aspect;
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

function getInitialRect(aspect: number): OgpRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = vw * 0.6;
  const height = width / aspect;
  const x = (vw - width) / 2;
  const y = (vh - height) / 2;
  return clampRect({ x, y, width, height }, aspect);
}

function resizeFromHandle(
  handle: HandleId,
  sr: OgpRect,
  dx: number,
  dy: number,
  aspect: number,
): OgpRect {
  switch (handle) {
    case 'se': {
      let w = sr.width + dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / aspect;
      return { x: sr.x, y: sr.y, width: w, height: h };
    }
    case 'sw': {
      let w = sr.width - dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / aspect;
      return { x: sr.x + sr.width - w, y: sr.y, width: w, height: h };
    }
    case 'ne': {
      let w = sr.width + dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / aspect;
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
      const h = w / aspect;
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
      const h = w / aspect;
      const centerY = sr.y + sr.height / 2;
      return { x: sr.x, y: centerY - h / 2, width: w, height: h };
    }
    case 'w': {
      let w = sr.width - dx;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      const h = w / aspect;
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
      let w = h * aspect;
      if (w < MIN_WIDTH) {
        w = MIN_WIDTH;
        h = w / aspect;
      }
      const centerX = sr.x + sr.width / 2;
      return { x: centerX - w / 2, y: sr.y, width: w, height: h };
    }
    case 'n': {
      let h = sr.height - dy;
      let w = h * aspect;
      if (w < MIN_WIDTH) {
        w = MIN_WIDTH;
        h = w / aspect;
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
  onEdit,
}: OgpSelectionOverlayProps) {
  const [aspectConfig, setAspectConfig] = useState<AspectConfig>({
    mode: 'ogp',
    freeW: 16,
    freeH: 9,
    fixedW: 800,
    fixedH: 600,
  });

  const aspect = getAspect(aspectConfig);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  const [rect, setRect] = useState<OgpRect>(() => getInitialRect(OGP_ASPECT));
  const [copyFeedback, setCopyFeedback] = useState(false);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const handleAspectChange = useCallback((newConfig: AspectConfig) => {
    setAspectConfig(newConfig);
    const newAspect = getAspect(newConfig);
    setRect(prev => {
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;
      const newWidth = prev.width;
      const newHeight = newWidth / newAspect;
      return clampRect({
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
        width: newWidth,
        height: newHeight,
      }, newAspect);
    });
  }, []);

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
          }, aspectRef.current),
        );
        return;
      }

      if (drag.type === 'resize') {
        setRect(clampRect(resizeFromHandle(drag.handle, sr, dx, dy, aspectRef.current), aspectRef.current));
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

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

      {/* Aspect ratio toolbar */}
      <div className="ogp-aspect-toolbar" style={{ top: barTop - 70 }}>
        <div className="ogp-clip-toolbar-row">
          {(['ogp', 'square', 'free', 'fixed'] as const).map(mode => (
            <button
              key={mode}
              className={`btn ogp-clip-mode-btn ${aspectConfig.mode === mode ? 'active' : ''}`}
              onClick={() => handleAspectChange({ ...aspectConfig, mode })}
            >
              {mode === 'ogp' ? 'OGP' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div className="ogp-clip-detail">
          {aspectConfig.mode === 'ogp' && <span>{OGP_WIDTH} : {OGP_HEIGHT}</span>}
          {aspectConfig.mode === 'square' && <span>1 : 1</span>}
          {aspectConfig.mode === 'free' && (
            <>
              <input type="number" className="ogp-clip-detail-input" min={1}
                value={aspectConfig.freeW}
                onChange={e => { const v = Number(e.target.value); if (v >= 1) handleAspectChange({ ...aspectConfig, freeW: v }); }} />
              <span className="ogp-clip-detail-separator">:</span>
              <input type="number" className="ogp-clip-detail-input" min={1}
                value={aspectConfig.freeH}
                onChange={e => { const v = Number(e.target.value); if (v >= 1) handleAspectChange({ ...aspectConfig, freeH: v }); }} />
            </>
          )}
          {aspectConfig.mode === 'fixed' && (
            <>
              <input type="number" className="ogp-clip-detail-input" min={1}
                value={aspectConfig.fixedW}
                onChange={e => { const v = Number(e.target.value); if (v >= 1) handleAspectChange({ ...aspectConfig, fixedW: v }); }} />
              <span className="ogp-clip-detail-separator">&times;</span>
              <input type="number" className="ogp-clip-detail-input" min={1}
                value={aspectConfig.fixedH}
                onChange={e => { const v = Number(e.target.value); if (v >= 1) handleAspectChange({ ...aspectConfig, fixedH: v }); }} />
              <span>px</span>
            </>
          )}
        </div>
      </div>

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
        <button className="btn ogp-btn-edit" onClick={() => onEdit(rect)}>
          OGP Edit
        </button>
        <button className="btn ogp-btn-exit" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}
