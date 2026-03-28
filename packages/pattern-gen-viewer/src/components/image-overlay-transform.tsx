import { useEffect, useCallback, useRef } from 'react';
import './image-overlay-transform.css';

export interface ImageTransform {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageOverlayTransformProps {
  transform: ImageTransform;
  onChange: (transform: ImageTransform) => void;
  keepAspectRatio: boolean;
  onKeepAspectRatioChange: (keep: boolean) => void;
  imageAspect: number;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type DragState =
  | { type: 'move'; startMouseX: number; startMouseY: number; startTransform: ImageTransform }
  | { type: 'resize'; handle: HandleId; startMouseX: number; startMouseY: number; startTransform: ImageTransform };

interface HandleDef {
  id: HandleId;
  cursor: string;
  getPos: (r: ImageTransform) => { left: number; top: number };
}

const HANDLES: HandleDef[] = [
  { id: 'nw', cursor: 'nw-resize', getPos: (r) => ({ left: r.x, top: r.y }) },
  { id: 'n', cursor: 'n-resize', getPos: (r) => ({ left: r.x + r.width / 2, top: r.y }) },
  { id: 'ne', cursor: 'ne-resize', getPos: (r) => ({ left: r.x + r.width, top: r.y }) },
  { id: 'e', cursor: 'e-resize', getPos: (r) => ({ left: r.x + r.width, top: r.y + r.height / 2 }) },
  { id: 'se', cursor: 'se-resize', getPos: (r) => ({ left: r.x + r.width, top: r.y + r.height }) },
  { id: 's', cursor: 's-resize', getPos: (r) => ({ left: r.x + r.width / 2, top: r.y + r.height }) },
  { id: 'sw', cursor: 'sw-resize', getPos: (r) => ({ left: r.x, top: r.y + r.height }) },
  { id: 'w', cursor: 'w-resize', getPos: (r) => ({ left: r.x, top: r.y + r.height / 2 }) },
];

const MIN_SIZE = 20;

function resizeFromHandle(
  handle: HandleId,
  sr: ImageTransform,
  dx: number,
  dy: number,
  aspect: number | null,
  centerAnchored: boolean,
): ImageTransform {
  // Center-anchored resize (Alt+drag): center stays fixed
  if (centerAnchored) {
    const cx = sr.x + sr.width / 2;
    const cy = sr.y + sr.height / 2;

    if (aspect !== null) {
      let w: number;
      switch (handle) {
        case 'se': case 'ne': case 'e':
          w = sr.width + dx * 2; break;
        case 'sw': case 'nw': case 'w':
          w = sr.width - dx * 2; break;
        case 's':
          w = (sr.height + dy * 2) * aspect; break;
        case 'n':
          w = (sr.height - dy * 2) * aspect; break;
        default: { const _: never = handle; w = _; }
      }
      if (w < MIN_SIZE) w = MIN_SIZE;
      let h = w / aspect;
      if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
      return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
    }

    let w = sr.width;
    let h = sr.height;
    switch (handle) {
      case 'se': w += dx * 2; h += dy * 2; break;
      case 'ne': w += dx * 2; h -= dy * 2; break;
      case 'sw': w -= dx * 2; h += dy * 2; break;
      case 'nw': w -= dx * 2; h -= dy * 2; break;
      case 'e': w += dx * 2; break;
      case 'w': w -= dx * 2; break;
      case 's': h += dy * 2; break;
      case 'n': h -= dy * 2; break;
    }
    if (w < MIN_SIZE) w = MIN_SIZE;
    if (h < MIN_SIZE) h = MIN_SIZE;
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
  }

  // Aspect-locked resize (edge-anchored)
  if (aspect !== null) {
    switch (handle) {
      case 'se': {
        let w = sr.width + dx;
        if (w < MIN_SIZE) w = MIN_SIZE;
        let h = w / aspect;
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        return { x: sr.x, y: sr.y, width: w, height: h };
      }
      case 'sw': {
        let w = sr.width - dx;
        if (w < MIN_SIZE) w = MIN_SIZE;
        let h = w / aspect;
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        return { x: sr.x + sr.width - w, y: sr.y, width: w, height: h };
      }
      case 'ne': {
        let w = sr.width + dx;
        if (w < MIN_SIZE) w = MIN_SIZE;
        let h = w / aspect;
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        return { x: sr.x, y: sr.y + sr.height - h, width: w, height: h };
      }
      case 'nw': {
        let w = sr.width - dx;
        if (w < MIN_SIZE) w = MIN_SIZE;
        let h = w / aspect;
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        return { x: sr.x + sr.width - w, y: sr.y + sr.height - h, width: w, height: h };
      }
      case 'e': {
        let w = sr.width + dx;
        if (w < MIN_SIZE) w = MIN_SIZE;
        let h = w / aspect;
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        const cy = sr.y + sr.height / 2;
        return { x: sr.x, y: cy - h / 2, width: w, height: h };
      }
      case 'w': {
        let w = sr.width - dx;
        if (w < MIN_SIZE) w = MIN_SIZE;
        let h = w / aspect;
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        const cy = sr.y + sr.height / 2;
        return { x: sr.x + sr.width - w, y: cy - h / 2, width: w, height: h };
      }
      case 's': {
        let h = sr.height + dy;
        let w = h * aspect;
        if (w < MIN_SIZE) { w = MIN_SIZE; h = w / aspect; }
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        const cx = sr.x + sr.width / 2;
        return { x: cx - w / 2, y: sr.y, width: w, height: h };
      }
      case 'n': {
        let h = sr.height - dy;
        let w = h * aspect;
        if (w < MIN_SIZE) { w = MIN_SIZE; h = w / aspect; }
        if (h < MIN_SIZE) { h = MIN_SIZE; w = h * aspect; }
        const cx = sr.x + sr.width / 2;
        return { x: cx - w / 2, y: sr.y + sr.height - h, width: w, height: h };
      }
      default: { const _: never = handle; return _; }
    }
  }

  // Free resize (edge-anchored)
  switch (handle) {
    case 'se':
      return { x: sr.x, y: sr.y, width: Math.max(MIN_SIZE, sr.width + dx), height: Math.max(MIN_SIZE, sr.height + dy) };
    case 'sw': {
      const w = Math.max(MIN_SIZE, sr.width - dx);
      return { x: sr.x + sr.width - w, y: sr.y, width: w, height: Math.max(MIN_SIZE, sr.height + dy) };
    }
    case 'ne': {
      const h = Math.max(MIN_SIZE, sr.height - dy);
      return { x: sr.x, y: sr.y + sr.height - h, width: Math.max(MIN_SIZE, sr.width + dx), height: h };
    }
    case 'nw': {
      const w = Math.max(MIN_SIZE, sr.width - dx);
      const h = Math.max(MIN_SIZE, sr.height - dy);
      return { x: sr.x + sr.width - w, y: sr.y + sr.height - h, width: w, height: h };
    }
    case 'e':
      return { ...sr, width: Math.max(MIN_SIZE, sr.width + dx) };
    case 'w': {
      const w = Math.max(MIN_SIZE, sr.width - dx);
      return { x: sr.x + sr.width - w, y: sr.y, width: w, height: sr.height };
    }
    case 's':
      return { ...sr, height: Math.max(MIN_SIZE, sr.height + dy) };
    case 'n': {
      const h = Math.max(MIN_SIZE, sr.height - dy);
      return { x: sr.x, y: sr.y + sr.height - h, width: sr.width, height: h };
    }
    default: { const _: never = handle; return _; }
  }
}

export function ImageOverlayTransform({
  transform,
  onChange,
  keepAspectRatio,
  onKeepAspectRatioChange,
  imageAspect,
}: ImageOverlayTransformProps) {
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const keepAspectRef = useRef(keepAspectRatio);
  keepAspectRef.current = keepAspectRatio;
  const imageAspectRef = useRef(imageAspect);
  imageAspectRef.current = imageAspect;

  const dragRef = useRef<DragState | null>(null);

  // Global mouse move/up for drag and resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();

      const dx = e.clientX - drag.startMouseX;
      const dy = e.clientY - drag.startMouseY;
      const sr = drag.startTransform;

      if (drag.type === 'move') {
        onChange({
          x: sr.x + dx,
          y: sr.y + dy,
          width: sr.width,
          height: sr.height,
        });
        return;
      }

      const aspect = keepAspectRef.current ? imageAspectRef.current : null;
      const centerAnchored = e.altKey;
      onChange(resizeFromHandle(drag.handle, sr, dx, dy, aspect, centerAnchored));
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
  }, [onChange]);

  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type: 'move',
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTransform: { ...transformRef.current },
    };
  }, []);

  const handleResizeStart = useCallback((handle: HandleId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type: 'resize',
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTransform: { ...transformRef.current },
    };
  }, []);

  const { x, y, width, height } = transform;
  const toolbarTop = Math.max(4, y - 36);

  return (
    <div className="image-overlay-transform">
      {/* Bounds outline — draggable for move */}
      <div
        className="image-overlay-bounds"
        style={{ left: x, top: y, width, height }}
        onMouseDown={handleMoveStart}
      />

      {/* 8 resize handles */}
      {HANDLES.map((h) => {
        const pos = h.getPos(transform);
        return (
          <div
            key={h.id}
            className="image-overlay-handle"
            style={{ left: pos.left, top: pos.top, cursor: h.cursor }}
            onMouseDown={(e) => handleResizeStart(h.id, e)}
          />
        );
      })}

      {/* Floating toolbar */}
      <div
        className="image-overlay-toolbar"
        style={{ left: x + width / 2, top: toolbarTop }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className={`image-overlay-mode-btn${keepAspectRatio ? ' active' : ''}`}
          onClick={() => onKeepAspectRatioChange(true)}
        >
          Original
        </button>
        <button
          className={`image-overlay-mode-btn${!keepAspectRatio ? ' active' : ''}`}
          onClick={() => onKeepAspectRatioChange(false)}
        >
          Free
        </button>
      </div>
    </div>
  );
}
