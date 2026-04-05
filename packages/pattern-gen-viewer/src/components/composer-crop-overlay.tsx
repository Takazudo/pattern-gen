import { useState, useCallback, useRef, useEffect } from 'react';
import type { CropRect } from '@takazudo/pattern-gen-core';
import './composer-crop-overlay.css';

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const MIN_CROP_FRACTION = 0.02; // minimum 2% in either dimension

interface HandleDef {
  id: HandleId;
  cursor: string;
  getPctPos: (r: CropRect) => { leftPct: number; topPct: number };
}

const HANDLES: HandleDef[] = [
  { id: 'nw', cursor: 'nw-resize', getPctPos: (r) => ({ leftPct: r.x * 100, topPct: r.y * 100 }) },
  { id: 'n', cursor: 'n-resize', getPctPos: (r) => ({ leftPct: (r.x + r.width / 2) * 100, topPct: r.y * 100 }) },
  { id: 'ne', cursor: 'ne-resize', getPctPos: (r) => ({ leftPct: (r.x + r.width) * 100, topPct: r.y * 100 }) },
  { id: 'e', cursor: 'e-resize', getPctPos: (r) => ({ leftPct: (r.x + r.width) * 100, topPct: (r.y + r.height / 2) * 100 }) },
  { id: 'se', cursor: 'se-resize', getPctPos: (r) => ({ leftPct: (r.x + r.width) * 100, topPct: (r.y + r.height) * 100 }) },
  { id: 's', cursor: 's-resize', getPctPos: (r) => ({ leftPct: (r.x + r.width / 2) * 100, topPct: (r.y + r.height) * 100 }) },
  { id: 'sw', cursor: 'sw-resize', getPctPos: (r) => ({ leftPct: r.x * 100, topPct: (r.y + r.height) * 100 }) },
  { id: 'w', cursor: 'w-resize', getPctPos: (r) => ({ leftPct: r.x * 100, topPct: (r.y + r.height / 2) * 100 }) },
];

type DragState =
  | { type: 'move'; startMouseX: number; startMouseY: number; startRect: CropRect }
  | { type: 'resize'; handle: HandleId; startMouseX: number; startMouseY: number; startRect: CropRect };

function clampCrop(rect: CropRect): CropRect {
  let { x, y, width, height } = rect;
  if (width < MIN_CROP_FRACTION) width = MIN_CROP_FRACTION;
  if (height < MIN_CROP_FRACTION) height = MIN_CROP_FRACTION;
  if (width > 1) width = 1;
  if (height > 1) height = 1;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > 1) x = 1 - width;
  if (y + height > 1) y = 1 - height;
  return { x, y, width, height };
}

function resizeFromHandle(
  handle: HandleId,
  sr: CropRect,
  dfx: number,
  dfy: number,
): CropRect {
  switch (handle) {
    case 'se':
      return { x: sr.x, y: sr.y, width: sr.width + dfx, height: sr.height + dfy };
    case 'sw':
      return { x: sr.x + dfx, y: sr.y, width: sr.width - dfx, height: sr.height + dfy };
    case 'ne':
      return { x: sr.x, y: sr.y + dfy, width: sr.width + dfx, height: sr.height - dfy };
    case 'nw':
      return { x: sr.x + dfx, y: sr.y + dfy, width: sr.width - dfx, height: sr.height - dfy };
    case 'e':
      return { x: sr.x, y: sr.y, width: sr.width + dfx, height: sr.height };
    case 'w':
      return { x: sr.x + dfx, y: sr.y, width: sr.width - dfx, height: sr.height };
    case 's':
      return { x: sr.x, y: sr.y, width: sr.width, height: sr.height + dfy };
    case 'n':
      return { x: sr.x, y: sr.y + dfy, width: sr.width, height: sr.height - dfy };
    default: {
      const _exhaustive: never = handle;
      return _exhaustive;
    }
  }
}

interface ComposerCropOverlayProps {
  initialCrop?: CropRect;
  onConfirm: (crop: CropRect) => void;
  onCancel: () => void;
  onClear: () => void;
  hasCrop: boolean;
}

export function ComposerCropOverlay({
  initialCrop,
  onConfirm,
  onCancel,
  onClear,
  hasCrop,
}: ComposerCropOverlayProps) {
  const [rect, setRect] = useState<CropRect>(
    () => initialCrop ?? { x: 0, y: 0, width: 1, height: 1 },
  );
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const dragRef = useRef<DragState | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(rectRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onConfirm]);

  // Convert mouse pixel delta to fraction delta
  const getFractionDelta = useCallback(
    (dxPx: number, dyPx: number): { dfx: number; dfy: number } => {
      const el = overlayRef.current;
      if (!el) return { dfx: 0, dfy: 0 };
      return {
        dfx: dxPx / el.offsetWidth,
        dfy: dyPx / el.offsetHeight,
      };
    },
    [],
  );

  // Global pointer move/up for dragging (supports mouse + touch)
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();

      const dxPx = e.clientX - drag.startMouseX;
      const dyPx = e.clientY - drag.startMouseY;
      const { dfx, dfy } = getFractionDelta(dxPx, dyPx);
      const sr = drag.startRect;

      if (drag.type === 'move') {
        setRect(
          clampCrop({
            x: sr.x + dfx,
            y: sr.y + dfy,
            width: sr.width,
            height: sr.height,
          }),
        );
      } else if (drag.type === 'resize') {
        setRect(clampCrop(resizeFromHandle(drag.handle, sr, dfx, dfy)));
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [getFractionDelta]);

  const handleMoveStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      type: 'move',
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startRect: { ...rectRef.current },
    };
  }, []);

  const handleResizeStart = useCallback(
    (handle: HandleId, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
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

  // Convert fractions to percentages for CSS
  const pctX = rect.x * 100;
  const pctY = rect.y * 100;
  const pctW = rect.width * 100;
  const pctH = rect.height * 100;

  // Flip toolbar to top when crop extends near the bottom edge
  const toolbarOnTop = rect.y + rect.height > 0.85;

  return (
    <div className="crop-overlay" ref={overlayRef}>
      {/* Dim regions around crop rect */}
      <div
        className="crop-dim crop-dim-top"
        style={{ height: `${pctY}%` }}
      />
      <div
        className="crop-dim crop-dim-bottom"
        style={{ top: `${pctY + pctH}%`, height: `${100 - pctY - pctH}%` }}
      />
      <div
        className="crop-dim crop-dim-left"
        style={{ top: `${pctY}%`, width: `${pctX}%`, height: `${pctH}%` }}
      />
      <div
        className="crop-dim crop-dim-right"
        style={{
          top: `${pctY}%`,
          left: `${pctX + pctW}%`,
          width: `${100 - pctX - pctW}%`,
          height: `${pctH}%`,
        }}
      />

      {/* Draggable crop area */}
      <div
        className="crop-box"
        style={{
          left: `${pctX}%`,
          top: `${pctY}%`,
          width: `${pctW}%`,
          height: `${pctH}%`,
        }}
        onPointerDown={handleMoveStart}
      >
        {/* Confirm/Cancel toolbar */}
        <div
          className="crop-toolbar"
          style={toolbarOnTop ? { bottom: 'auto', top: -36 } : undefined}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hasCrop && (
            <button
              className="crop-toolbar-btn crop-toolbar-btn-clear"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              title="Remove crop"
            >
              Remove
            </button>
          )}
          <button
            className="crop-toolbar-btn crop-toolbar-btn-cancel"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            title="Cancel (Esc)"
            aria-label="Cancel crop"
          >
            &#x2715;
          </button>
          <button
            className="crop-toolbar-btn crop-toolbar-btn-confirm"
            onClick={(e) => { e.stopPropagation(); onConfirm(rect); }}
            title="Apply crop (Enter)"
            aria-label="Apply crop"
          >
            &#x2713;
          </button>
        </div>
      </div>

      {/* 8 resize handles */}
      {HANDLES.map((h) => {
        const { leftPct, topPct } = h.getPctPos(rect);
        return (
          <div
            key={h.id}
            className="crop-handle"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              cursor: h.cursor,
            }}
            onPointerDown={(e) => handleResizeStart(h.id, e)}
          />
        );
      })}
    </div>
  );
}
