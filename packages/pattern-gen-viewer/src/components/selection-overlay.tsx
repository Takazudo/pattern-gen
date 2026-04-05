import { useState, useEffect, useCallback, useRef } from 'react';
import { OGP_WIDTH, OGP_HEIGHT, getAspect, getOutputDimensions } from '@takazudo/pattern-gen-core';
import type { AspectMode, AspectConfig } from '@takazudo/pattern-gen-core';
import type { PresetSize } from '@takazudo/pattern-gen-core';
import { PresetSizeChooser } from './preset-size-chooser.js';
import './selection-overlay.css';

export type { AspectMode, AspectConfig };
export { getOutputDimensions };

const OGP_ASPECT = OGP_WIDTH / OGP_HEIGHT;
const MIN_WIDTH = 100;

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionOverlayProps {
  /** Callback when user clicks Generate or presses Enter */
  onGenerate: (rect: SelectionRect) => void;
  /** Callback when user presses Escape or clicks Exit */
  onExit: () => void;
  /** Callback to download config as JSON file */
  onDownloadJson: (rect: SelectionRect) => void;
  /** Callback to copy config JSON to clipboard; resolves on success */
  onCopyJson: (rect: SelectionRect) => Promise<void>;
  /** Callback to enter the Composer with current selection */
  onEdit: (rect: SelectionRect, aspectConfig: AspectConfig) => void;
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const DEFAULT_ASPECT_CONFIG: AspectConfig = {
  mode: 'ogp',
  freeW: 16,
  freeH: 9,
  fixedW: 800,
  fixedH: 600,
};

type DragState =
  | { type: 'move'; startMouseX: number; startMouseY: number; startRect: SelectionRect }
  | { type: 'resize'; handle: HandleId; startMouseX: number; startMouseY: number; startRect: SelectionRect };

interface ToolbarDragState {
  startMouseX: number;
  startMouseY: number;
  startPos: { x: number; y: number };
}

interface HandleDef {
  id: HandleId;
  cursor: string;
  getPos: (r: SelectionRect) => { left: number; top: number };
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

const ASPECT_MODE_LABELS: { mode: AspectMode; label: string }[] = [
  { mode: 'ogp', label: 'OGP' },
  { mode: 'square', label: 'Square' },
  { mode: 'free', label: 'Free' },
  { mode: 'fixed', label: 'Fixed' },
];

function clampRect(rect: SelectionRect, aspect: number): SelectionRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let { x, y, width, height } = rect;

  if (width < MIN_WIDTH) {
    width = MIN_WIDTH;
    height = width / aspect;
  }

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

function getInitialRect(aspect: number): SelectionRect {
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
  sr: SelectionRect,
  dx: number,
  dy: number,
  aspect: number,
): SelectionRect {
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

function applyCenterAnchor(sr: SelectionRect, resized: SelectionRect, aspect: number): SelectionRect {
  const centerX = sr.x + sr.width / 2;
  const centerY = sr.y + sr.height / 2;
  const dw = resized.width - sr.width;
  let newWidth = sr.width + dw * 2;
  if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
  const newHeight = newWidth / aspect;
  return {
    x: centerX - newWidth / 2,
    y: centerY - newHeight / 2,
    width: newWidth,
    height: newHeight,
  };
}

function reclampToAspect(rect: SelectionRect, aspect: number): SelectionRect {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  let width = rect.width;
  let height = width / aspect;
  if (height > window.innerHeight) {
    height = window.innerHeight;
    width = height * aspect;
  }
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  return clampRect({ x, y, width, height }, aspect);
}

function clampToolbarPos(
  pos: { x: number; y: number },
  toolbarEl: HTMLDivElement | null,
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = toolbarEl?.offsetWidth ?? 300;
  const th = toolbarEl?.offsetHeight ?? 150;
  return {
    x: Math.max(0, Math.min(pos.x, vw - tw)),
    y: Math.max(0, Math.min(pos.y, vh - th)),
  };
}

export function SelectionOverlay({
  onGenerate,
  onExit,
  onDownloadJson,
  onCopyJson,
  onEdit,
}: SelectionOverlayProps) {
  const [aspectConfig, setAspectConfig] = useState<AspectConfig>(DEFAULT_ASPECT_CONFIG);
  const [showPresets, setShowPresets] = useState(false);
  const aspect = getAspect(aspectConfig);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;
  const aspectConfigRef = useRef(aspectConfig);
  aspectConfigRef.current = aspectConfig;

  const [rect, setRect] = useState<SelectionRect>(() => getInitialRect(OGP_ASPECT));
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isAltResize, setIsAltResize] = useState(false);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const [toolbarPos, setToolbarPos] = useState(() => ({
    x: (window.innerWidth - 340) / 2,
    y: 20,
  }));
  const toolbarPosRef = useRef(toolbarPos);
  toolbarPosRef.current = toolbarPos;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarDragRef = useRef<ToolbarDragState | null>(null);

  const dragRef = useRef<DragState | null>(null);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
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

  // Global mouse move/up for selection drag and toolbar drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Toolbar drag
      const tbDrag = toolbarDragRef.current;
      if (tbDrag) {
        e.preventDefault();
        const dx = e.clientX - tbDrag.startMouseX;
        const dy = e.clientY - tbDrag.startMouseY;
        setToolbarPos(
          clampToolbarPos(
            {
              x: tbDrag.startPos.x + dx,
              y: tbDrag.startPos.y + dy,
            },
            toolbarRef.current,
          ),
        );
        return;
      }

      // Selection drag
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();

      const dx = e.clientX - drag.startMouseX;
      const dy = e.clientY - drag.startMouseY;
      const sr = drag.startRect;

      if (drag.type === 'move') {
        setRect(
          clampRect(
            {
              x: sr.x + dx,
              y: sr.y + dy,
              width: sr.width,
              height: sr.height,
            },
            aspectRef.current,
          ),
        );
        return;
      }

      if (drag.type === 'resize') {
        let resized = resizeFromHandle(drag.handle, sr, dx, dy, aspectRef.current);
        if (e.altKey) {
          resized = applyCenterAnchor(sr, resized, aspectRef.current);
        }
        setIsAltResize(e.altKey);
        setRect(clampRect(resized, aspectRef.current));
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      toolbarDragRef.current = null;
      setIsAltResize(false);
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

  const handleCopy = useCallback(
    (r: SelectionRect) => {
      onCopyJson(r)
        .then(() => {
          setCopyFeedback(true);
          clearTimeout(copyTimerRef.current);
          copyTimerRef.current = setTimeout(() => setCopyFeedback(false), 1500);
        })
        .catch(() => {
          /* clipboard denied */
        });
    },
    [onCopyJson],
  );

  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type: 'move',
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startRect: { ...rectRef.current },
    };
  }, []);

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

  const handleToolbarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toolbarDragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPos: { ...toolbarPosRef.current },
    };
  }, []);

  const handleModeChange = useCallback((mode: AspectMode) => {
    const newAspect = getAspect({ ...aspectConfigRef.current, mode });
    setAspectConfig((prev) => ({ ...prev, mode }));
    setRect((r) => reclampToAspect(r, newAspect));
  }, []);

  const handleAspectInputChange = useCallback(
    (field: 'freeW' | 'freeH' | 'fixedW' | 'fixedH', value: string) => {
      const num = Number(value) || 1;
      const newAspect = getAspect({ ...aspectConfigRef.current, [field]: num });
      setAspectConfig((prev) => ({ ...prev, [field]: num }));
      setRect((r) => reclampToAspect(r, newAspect));
    },
    [],
  );

  const handlePresetSelect = useCallback((preset: PresetSize) => {
    const newConfig: AspectConfig = {
      ...aspectConfigRef.current,
      mode: 'fixed',
      fixedW: preset.width,
      fixedH: preset.height,
    };
    const newAspect = getAspect(newConfig);
    setAspectConfig(newConfig);
    setRect((r) => reclampToAspect(r, newAspect));
  }, []);

  const { x, y, width, height } = rect;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <div className="selection-overlay">
      {/* Dim regions around selection */}
      <div className="selection-dim selection-dim-top" style={{ height: y }} />
      <div
        className="selection-dim selection-dim-bottom"
        style={{ top: y + height, height: vh - y - height }}
      />
      <div
        className="selection-dim selection-dim-left"
        style={{ top: y, width: x, height }}
      />
      <div
        className="selection-dim selection-dim-right"
        style={{
          top: y,
          left: x + width,
          width: vw - x - width,
          height,
        }}
      />

      {/* Draggable selection area */}
      <div
        className="selection-box"
        style={{ left: x, top: y, width, height }}
        onMouseDown={handleMoveStart}
      />

      {/* 8 resize handles */}
      {HANDLES.map((h) => {
        const pos = h.getPos(rect);
        return (
          <div
            key={h.id}
            className="selection-handle"
            style={{ left: pos.left, top: pos.top, cursor: h.cursor }}
            onMouseDown={(e) => handleResizeStart(h.id, e)}
          />
        );
      })}

      {/* Center indicator when Alt+resize is active */}
      {isAltResize && (
        <div
          className="selection-center-indicator"
          style={{
            left: x + width / 2,
            top: y + height / 2,
          }}
        />
      )}

      {/* Floating toolbar */}
      <div
        ref={toolbarRef}
        className="selection-toolbar"
        style={{ left: toolbarPos.x, top: toolbarPos.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="selection-toolbar-drag"
          onMouseDown={handleToolbarDragStart}
        >
          ⋮⋮⋮
        </div>

        {/* Aspect mode buttons + Presets */}
        <div className="selection-toolbar-row">
          {ASPECT_MODE_LABELS.map(({ mode, label }) => (
            <button
              key={mode}
              className={`selection-mode-btn${aspectConfig.mode === mode ? ' active' : ''}`}
              onClick={() => handleModeChange(mode)}
            >
              {label}
            </button>
          ))}
          <button
            className="selection-mode-btn selection-presets-btn"
            onClick={() => setShowPresets(true)}
          >
            Presets
          </button>
        </div>

        {/* Detail row */}
        <div className="selection-toolbar-row">
          <div className="selection-detail">
            {aspectConfig.mode === 'ogp' && (
              <>
                <span>{OGP_WIDTH}</span>
                <span className="selection-detail-separator">:</span>
                <span>{OGP_HEIGHT}</span>
              </>
            )}
            {aspectConfig.mode === 'square' && (
              <>
                <span>1</span>
                <span className="selection-detail-separator">:</span>
                <span>1</span>
              </>
            )}
            {aspectConfig.mode === 'free' && (
              <>
                <input
                  type="number"
                  className="selection-detail-input"
                  value={aspectConfig.freeW}
                  min={1}
                  onChange={(e) =>
                    handleAspectInputChange('freeW', e.target.value)
                  }
                />
                <span className="selection-detail-separator">:</span>
                <input
                  type="number"
                  className="selection-detail-input"
                  value={aspectConfig.freeH}
                  min={1}
                  onChange={(e) =>
                    handleAspectInputChange('freeH', e.target.value)
                  }
                />
              </>
            )}
            {aspectConfig.mode === 'fixed' && (
              <>
                <input
                  type="number"
                  className="selection-detail-input"
                  value={aspectConfig.fixedW}
                  min={1}
                  onChange={(e) =>
                    handleAspectInputChange('fixedW', e.target.value)
                  }
                />
                <span className="selection-detail-separator">px :</span>
                <input
                  type="number"
                  className="selection-detail-input"
                  value={aspectConfig.fixedH}
                  min={1}
                  onChange={(e) =>
                    handleAspectInputChange('fixedH', e.target.value)
                  }
                />
                <span className="selection-detail-separator">px</span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="selection-actions">
          <button
            className="btn selection-btn-generate"
            onClick={() => onGenerate(rect)}
          >
            Generate
          </button>
          <button
            className="btn selection-btn-json"
            onClick={() => onDownloadJson(rect)}
          >
            DL JSON
          </button>
          <button
            className="btn selection-btn-json"
            onClick={() => handleCopy(rect)}
          >
            {copyFeedback ? 'Copied!' : 'Copy JSON'}
          </button>
          <button className="btn selection-btn-edit" onClick={() => onEdit(rect, aspectConfig)}>
            Edit
          </button>
          <button className="btn selection-btn-exit" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>

      {/* Preset size chooser modal */}
      {showPresets && (
        <PresetSizeChooser
          onSelect={handlePresetSelect}
          onClose={() => setShowPresets(false)}
        />
      )}
    </div>
  );
}
