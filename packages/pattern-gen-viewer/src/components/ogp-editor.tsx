import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { parseOgpEditorConfig, hashString, createRandom } from '@takazudo/pattern-gen-core';
import type {
  OgpConfig,
  OgpEditorConfig,
  EditorLayer,
  FrameConfig,
  ImageLayerData,
  TextLayerData,
  LayerTransform,
} from '@takazudo/pattern-gen-core';
import { framesByName } from '@takazudo/pattern-gen-generators';
import { OgpEditorLayerPanel } from './ogp-editor-layer-panel.js';
import { loadGoogleFont, isFontLoaded } from './ogp-editor-font-picker.js';
import './ogp-editor.css';

/* ── Alignment ── */

export type AlignmentType =
  | 'align-left'
  | 'align-center-h'
  | 'align-right'
  | 'align-top'
  | 'align-middle-v'
  | 'align-bottom';

/* ── Props ── */

interface OgpEditorProps {
  backgroundImage: ImageBitmap | null;
  backgroundConfig: OgpConfig | null;
  outputWidth: number;
  outputHeight: number;
  onExit: () => void;
}

/* ── Grid types ── */

export interface GridConfig {
  vDivide: number;
  hDivide: number;
  snap: boolean;
  visible: boolean;
  lineColor: string;
}

/* ── Helpers ── */

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerData,
) {
  const t = layer.transform;
  const fontStyle = layer.fontStyle === 'italic' ? 'italic ' : '';
  const fontWeight = layer.fontWeight === 'bold' ? 'bold ' : '';
  ctx.font = `${fontStyle}${fontWeight}${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.textAlign;
  ctx.textBaseline = 'top';

  if (layer.letterSpacing !== 0) {
    (ctx as unknown as Record<string, unknown>).letterSpacing =
      `${layer.letterSpacing}px`;
  }

  if (layer.shadow.enabled) {
    ctx.shadowOffsetX = layer.shadow.offsetX;
    ctx.shadowOffsetY = layer.shadow.offsetY;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowColor = layer.shadow.color;
  }

  const lines = layer.content.split('\n');
  const lineHeightPx = layer.fontSize * layer.lineHeight;
  const totalTextHeight =
    (lines.length - 1) * lineHeightPx + layer.fontSize;

  let textX = t.x;
  if (layer.textAlign === 'center') textX = t.x + t.width / 2;
  else if (layer.textAlign === 'right') textX = t.x + t.width;

  let baseY = t.y;
  if (layer.textVAlign === 'middle') {
    baseY = t.y + (t.height - totalTextHeight) / 2;
  } else if (layer.textVAlign === 'bottom') {
    baseY = t.y + t.height - totalTextHeight;
  }

  for (let i = 0; i < lines.length; i++) {
    const y = baseY + i * lineHeightPx;

    if (layer.stroke.enabled) {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = layer.stroke.color;
      ctx.lineWidth = layer.stroke.width;
      ctx.lineJoin = 'round';
      ctx.strokeText(lines[i], textX, y);
      ctx.restore();
    }

    ctx.fillText(lines[i], textX, y);
  }

  // Note: letterSpacing is reset by the caller's ctx.save()/ctx.restore()
}

const HANDLE_SIZE = 8;
const MIN_LAYER_SIZE = 20;
const SNAP_THRESHOLD = 10;
const LOADING_FONT_DIM_FACTOR = 0.3;

function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  t: LayerTransform,
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(220, 220, 220, 1)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(t.x, t.y, t.width, t.height);
  ctx.setLineDash([]);

  // Corner handles
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'rgba(80, 80, 80, 1)';
  ctx.lineWidth = 1;
  const corners = [
    [t.x, t.y],
    [t.x + t.width, t.y],
    [t.x, t.y + t.height],
    [t.x + t.width, t.y + t.height],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(
      cx - HANDLE_SIZE / 2,
      cy - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
    );
    ctx.strokeRect(
      cx - HANDLE_SIZE / 2,
      cy - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
    );
  }
  ctx.restore();
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

function hitTestHandle(
  t: LayerTransform,
  cx: number,
  cy: number,
): ResizeHandle {
  const hs = HANDLE_SIZE + 4; // slightly larger hit area
  const corners: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: 'nw', x: t.x, y: t.y },
    { handle: 'ne', x: t.x + t.width, y: t.y },
    { handle: 'sw', x: t.x, y: t.y + t.height },
    { handle: 'se', x: t.x + t.width, y: t.y + t.height },
  ];
  for (const c of corners) {
    if (
      cx >= c.x - hs &&
      cx <= c.x + hs &&
      cy >= c.y - hs &&
      cy <= c.y + hs
    ) {
      return c.handle;
    }
  }
  return null;
}

function hitTestRect(
  t: LayerTransform,
  cx: number,
  cy: number,
): boolean {
  return cx >= t.x && cx <= t.x + t.width && cy >= t.y && cy <= t.y + t.height;
}

/* ── Grid helpers ── */

function drawGrid(
  ctx: CanvasRenderingContext2D,
  xPositions: number[],
  yPositions: number[],
  lineColor: string,
  canvasWidth: number,
  canvasHeight: number,
) {
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;

  // Skip edges (0 and totalSize) — only draw interior lines
  for (const x of xPositions) {
    if (x === 0 || x === canvasWidth) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  for (const y of yPositions) {
    if (y === 0 || y === canvasHeight) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}

function getGridPositions(totalSize: number, divide: number): number[] {
  const positions = [0, totalSize];
  for (let i = 1; i < divide; i++) {
    positions.push(Math.round(totalSize * i / divide));
  }
  return positions.sort((a, b) => a - b);
}

function snapToNearest(
  value: number,
  gridPositions: number[],
  threshold: number = SNAP_THRESHOLD,
): number {
  let best: number | null = null;
  let bestDist = threshold;
  for (const pos of gridPositions) {
    const dist = Math.abs(value - pos);
    if (dist < bestDist) {
      bestDist = dist;
      best = pos;
    }
  }
  return best ?? value;
}

function snapTransform(
  t: LayerTransform,
  xPositions: number[],
  yPositions: number[],
  threshold: number = SNAP_THRESHOLD,
): { x: number; y: number } {
  let newX = t.x;
  let newY = t.y;

  // Snap X: check left edge, center, right edge
  const leftSnap = snapToNearest(t.x, xPositions, threshold);
  const centerXSnap = snapToNearest(t.x + t.width / 2, xPositions, threshold);
  const rightSnap = snapToNearest(t.x + t.width, xPositions, threshold);

  if (leftSnap !== t.x) {
    newX = leftSnap;
  } else if (centerXSnap !== t.x + t.width / 2) {
    newX = centerXSnap - t.width / 2;
  } else if (rightSnap !== t.x + t.width) {
    newX = rightSnap - t.width;
  }

  // Snap Y: check top edge, center, bottom edge
  const topSnap = snapToNearest(t.y, yPositions, threshold);
  const centerYSnap = snapToNearest(t.y + t.height / 2, yPositions, threshold);
  const bottomSnap = snapToNearest(t.y + t.height, yPositions, threshold);

  if (topSnap !== t.y) {
    newY = topSnap;
  } else if (centerYSnap !== t.y + t.height / 2) {
    newY = centerYSnap - t.height / 2;
  } else if (bottomSnap !== t.y + t.height) {
    newY = bottomSnap - t.height;
  }

  return { x: newX, y: newY };
}

/* ── Main Component ── */

export function OgpEditor({
  backgroundImage,
  backgroundConfig,
  outputWidth,
  outputHeight,
  onExit,
}: OgpEditorProps) {
  const [layers, setLayers] = useState<(EditorLayer & { id: string })[]>(
    [],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    vDivide: 2,
    hDivide: 2,
    snap: false,
    visible: false,
    lineColor: 'rgba(180, 180, 180, 0.5)',
  });
  const [frameConfig, setFrameConfig] = useState<FrameConfig | null>(null);
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set());

  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize';
    id: string;
    startX: number;
    startY: number;
    startTransform: LayerTransform;
    handle?: ResizeHandle;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImagesRef = useRef(new Map<string, HTMLImageElement>());
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Canvas coordinate conversion (works with both React and native events)
  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (outputWidth / rect.width),
        y: (clientY - rect.top) * (outputHeight / rect.height),
      };
    },
    [outputWidth, outputHeight],
  );

  // Draw frame overlay
  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, frame: FrameConfig | null) => {
      if (!frame) return;
      const generator = framesByName.get(frame.type);
      if (!generator) return;
      const seed = hashString(frame.type);
      const rand = createRandom(seed);
      ctx.save();
      generator.render(
        ctx,
        { width: outputWidth, height: outputHeight, rand },
        frame.params,
      );
      ctx.restore();
    },
    [outputWidth, outputHeight],
  );

  // Shared layer drawing logic
  const drawLayers = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      bg: ImageBitmap | null,
      layerList: (EditorLayer & { id: string })[],
      images: Map<string, HTMLImageElement>,
      frame: FrameConfig | null,
      loadingFontSet?: Set<string>,
    ) => {
      ctx.clearRect(0, 0, outputWidth, outputHeight);
      if (bg) ctx.drawImage(bg, 0, 0, outputWidth, outputHeight);

      for (const layer of layerList) {
        ctx.save();
        const isLoading = loadingFontSet && layer.type === 'text' && loadingFontSet.has(layer.fontFamily);
        ctx.globalAlpha = isLoading ? layer.opacity * LOADING_FONT_DIM_FACTOR : layer.opacity;

        if (layer.type === 'image' && images.has(layer.id)) {
          const img = images.get(layer.id)!;
          const t = layer.transform;
          ctx.drawImage(img, t.x, t.y, t.width, t.height);
        }

        if (layer.type === 'text') {
          renderTextLayer(ctx, layer);
        }

        ctx.restore();
      }

      // Draw frame on top of all layers
      drawFrame(ctx, frame);
    },
    [drawFrame, outputWidth, outputHeight],
  );

  // Memoize grid positions to avoid re-allocation on every mousemove
  const xGridPositions = useMemo(
    () => getGridPositions(outputWidth, gridConfig.vDivide),
    [outputWidth, gridConfig.vDivide],
  );
  const yGridPositions = useMemo(
    () => getGridPositions(outputHeight, gridConfig.hDivide),
    [outputHeight, gridConfig.hDivide],
  );
  const xGridRef = useRef(xGridPositions);
  xGridRef.current = xGridPositions;
  const yGridRef = useRef(yGridPositions);
  yGridRef.current = yGridPositions;

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawLayers(ctx, backgroundImage, layers, loadedImagesRef.current, frameConfig, loadingFonts);

    // Draw selection handles for all selected layers
    for (const id of selectedIds) {
      const layer = layers.find((l) => l.id === id);
      if (layer) drawSelectionHandles(ctx, layer.transform);
    }

    // Draw grid overlay on top
    if (
      gridConfig.visible &&
      (gridConfig.vDivide > 1 || gridConfig.hDivide > 1)
    ) {
      drawGrid(ctx, xGridPositions, yGridPositions, gridConfig.lineColor, outputWidth, outputHeight);
    }
  }, [layers, backgroundImage, selectedIds, drawLayers, gridConfig, xGridPositions, yGridPositions, loadingFonts, frameConfig]);

  // Re-render when state changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Render to export canvas (no selection handles)
  const renderExportCanvas = useCallback((): HTMLCanvasElement => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = outputWidth;
    exportCanvas.height = outputHeight;
    const ctx = exportCanvas.getContext('2d')!;
    drawLayers(ctx, backgroundImage, layers, loadedImagesRef.current, frameConfig);
    return exportCanvas;
  }, [layers, backgroundImage, drawLayers, frameConfig, outputWidth, outputHeight]);

  // Build editor config JSON
  const buildEditorConfig = useCallback((): OgpEditorConfig | null => {
    if (!backgroundConfig) return null;
    return {
      version: 1,
      background: backgroundConfig,
      layers: layers.map(({ id: _id, ...rest }) => rest),
      ...(frameConfig ? { frame: frameConfig } : {}),
    };
  }, [layers, backgroundConfig, frameConfig]);

  // Mouse handlers
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      const isMultiSelect = e.metaKey || e.ctrlKey;

      // Check resize handles on selected layers first (only when single selected)
      if (selectedIds.length === 1) {
        const selected = layers.find((l) => l.id === selectedIds[0]);
        if (selected) {
          const handle = hitTestHandle(selected.transform, x, y);
          if (handle) {
            setDragState({
              type: 'resize',
              id: selectedIds[0],
              startX: x,
              startY: y,
              startTransform: { ...selected.transform },
              handle,
            });
            return;
          }
        }
      }

      // Hit test layers in reverse order (topmost first)
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        if (hitTestRect(layer.transform, x, y)) {
          if (isMultiSelect) {
            // Toggle the clicked layer in selection
            setSelectedIds((prev) =>
              prev.includes(layer.id)
                ? prev.filter((id) => id !== layer.id)
                : [...prev, layer.id],
            );
          } else {
            setSelectedIds([layer.id]);
            setDragState({
              type: 'move',
              id: layer.id,
              startX: x,
              startY: y,
              startTransform: { ...layer.transform },
            });
          }
          return;
        }
      }

      // Clicked empty space — deselect
      setSelectedIds([]);
    },
    [getCanvasCoords, layers, selectedIds],
  );

  // Global mouse move/up so dragging works outside the canvas bounds
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  const gridConfigRef = useRef(gridConfig);
  gridConfigRef.current = gridConfig;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      e.preventDefault();

      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      const st = drag.startTransform;

      if (drag.type === 'move') {
        const grid = gridConfigRef.current;
        let newX = st.x + dx;
        let newY = st.y + dy;

        if (grid.snap) {
          const snapped = snapTransform(
            { x: newX, y: newY, width: st.width, height: st.height },
            xGridRef.current,
            yGridRef.current,
          );
          newX = snapped.x;
          newY = snapped.y;
        }

        setLayers((prev) =>
          prev.map((l) =>
            l.id === drag.id
              ? {
                  ...l,
                  transform: {
                    ...l.transform,
                    x: newX,
                    y: newY,
                  },
                }
              : l,
          ),
        );
      } else if (drag.type === 'resize' && drag.handle) {
        const grid = gridConfigRef.current;
        setLayers((prev) =>
          prev.map((l) => {
            if (l.id !== drag.id) return l;
            const newT = { ...st };
            switch (drag.handle) {
              case 'se':
                newT.width = Math.max(MIN_LAYER_SIZE, st.width + dx);
                newT.height = Math.max(MIN_LAYER_SIZE, st.height + dy);
                break;
              case 'sw': {
                const newW = Math.max(MIN_LAYER_SIZE, st.width - dx);
                newT.x = st.x + st.width - newW;
                newT.width = newW;
                newT.height = Math.max(MIN_LAYER_SIZE, st.height + dy);
                break;
              }
              case 'ne': {
                const newH = Math.max(MIN_LAYER_SIZE, st.height - dy);
                newT.y = st.y + st.height - newH;
                newT.width = Math.max(MIN_LAYER_SIZE, st.width + dx);
                newT.height = newH;
                break;
              }
              case 'nw': {
                const newW = Math.max(MIN_LAYER_SIZE, st.width - dx);
                const newH = Math.max(MIN_LAYER_SIZE, st.height - dy);
                newT.x = st.x + st.width - newW;
                newT.y = st.y + st.height - newH;
                newT.width = newW;
                newT.height = newH;
                break;
              }
            }

            // Snap resize edges to grid
            if (grid.snap) {
              const handle = drag.handle!;

              if (handle === 'se' || handle === 'ne') {
                const snappedRight = snapToNearest(newT.x + newT.width, xGridRef.current);
                newT.width = Math.max(MIN_LAYER_SIZE, snappedRight - newT.x);
              }
              if (handle === 'sw' || handle === 'nw') {
                const snappedLeft = snapToNearest(newT.x, xGridRef.current);
                const right = newT.x + newT.width;
                newT.x = snappedLeft;
                newT.width = Math.max(MIN_LAYER_SIZE, right - snappedLeft);
              }
              if (handle === 'se' || handle === 'sw') {
                const snappedBottom = snapToNearest(newT.y + newT.height, yGridRef.current);
                newT.height = Math.max(MIN_LAYER_SIZE, snappedBottom - newT.y);
              }
              if (handle === 'ne' || handle === 'nw') {
                const snappedTop = snapToNearest(newT.y, yGridRef.current);
                const bottom = newT.y + newT.height;
                newT.y = snappedTop;
                newT.height = Math.max(MIN_LAYER_SIZE, bottom - snappedTop);
              }
            }

            return { ...l, transform: newT };
          }),
        );
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getCanvasCoords]);

  // Layer CRUD
  const handleAddImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const id = crypto.randomUUID();
        const newLayer: ImageLayerData & { id: string } = {
          id,
          type: 'image',
          name: file.name,
          src: reader.result as string,
          transform: { x: 100, y: 100, width: 300, height: 300 },
          opacity: 1,
        };

        // Load the image for rendering
        const img = new Image();
        img.onload = () => {
          loadedImagesRef.current.set(id, img);
          // Adjust default size to maintain aspect ratio
          const aspect = img.naturalWidth / img.naturalHeight;
          const w = 300;
          const h = Math.round(w / aspect);
          setLayers((prev) =>
            prev.map((l) =>
              l.id === id
                ? { ...l, transform: { ...l.transform, width: w, height: h } }
                : l,
            ),
          );
        };
        img.src = reader.result as string;

        setLayers((prev) => [...prev, newLayer]);
        setSelectedIds([id]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  // Track a font load: add to loadingFonts, remove when loaded
  const trackFontLoad = useCallback((family: string) => {
    if (isFontLoaded(family)) return;
    setLoadingFonts((prev) => new Set(prev).add(family));
    loadGoogleFont(family).finally(() => {
      setLoadingFonts((prev) => {
        const next = new Set(prev);
        next.delete(family);
        return next;
      });
    });
  }, []);

  const handleAddText = useCallback(() => {
    const id = crypto.randomUUID();
    const newLayer: TextLayerData & { id: string } = {
      id,
      type: 'text',
      name: 'New Text',
      content: 'Hello World',
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#ffffff',
      opacity: 1,
      textAlign: 'left',
      textVAlign: 'top',
      letterSpacing: 0,
      lineHeight: 1.4,
      shadow: {
        enabled: false,
        offsetX: 2,
        offsetY: 2,
        blur: 4,
        color: 'rgba(0,0,0,0.5)',
      },
      stroke: { enabled: false, color: '#000000', width: 2 },
      transform: { x: 100, y: 200, width: 400, height: 100 },
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedIds([id]);
    trackFontLoad('Inter');
  }, [trackFontLoad]);

  const handleLayerUpdate = useCallback(
    (id: string, updates: Partial<EditorLayer>) => {
      // Track font loading when fontFamily changes
      if ('fontFamily' in updates && typeof updates.fontFamily === 'string') {
        trackFontLoad(updates.fontFamily);
      }

      // If image src changed, reload the HTMLImageElement
      if ('src' in updates && typeof updates.src === 'string') {
        const img = new Image();
        img.onload = () => {
          loadedImagesRef.current.set(id, img);
          // Trigger re-render
          setLayers((prev) => [...prev]);
        };
        img.src = updates.src;
      }

      setLayers((prev) =>
        prev.map((l) =>
          l.id === id ? ({ ...l, ...updates } as EditorLayer & { id: string }) : l,
        ),
      );
    },
    [trackFontLoad],
  );

  const handleLayerDelete = useCallback(
    (id: string) => {
      setLayers((prev) => prev.filter((l) => l.id !== id));
      loadedImagesRef.current.delete(id);
      setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    },
    [],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setLayers((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [],
  );

  // Alignment handler
  const handleAlignLayers = useCallback(
    (ids: string[], alignment: AlignmentType) => {
      setLayers((prev) => {
        const targets = prev.filter((l) => ids.includes(l.id));
        if (targets.length < 2) return prev;

        const transforms = targets.map((l) => l.transform);

        let getNewX: ((t: LayerTransform) => number) | null = null;
        let getNewY: ((t: LayerTransform) => number) | null = null;

        switch (alignment) {
          case 'align-left': {
            const minX = Math.min(...transforms.map((t) => t.x));
            getNewX = () => minX;
            break;
          }
          case 'align-center-h': {
            const minX = Math.min(...transforms.map((t) => t.x));
            const maxRight = Math.max(...transforms.map((t) => t.x + t.width));
            const centerX = (minX + maxRight) / 2;
            getNewX = (t) => centerX - t.width / 2;
            break;
          }
          case 'align-right': {
            const maxRight = Math.max(...transforms.map((t) => t.x + t.width));
            getNewX = (t) => maxRight - t.width;
            break;
          }
          case 'align-top': {
            const minY = Math.min(...transforms.map((t) => t.y));
            getNewY = () => minY;
            break;
          }
          case 'align-middle-v': {
            const minY = Math.min(...transforms.map((t) => t.y));
            const maxBottom = Math.max(
              ...transforms.map((t) => t.y + t.height),
            );
            const centerY = (minY + maxBottom) / 2;
            getNewY = (t) => centerY - t.height / 2;
            break;
          }
          case 'align-bottom': {
            const maxBottom = Math.max(
              ...transforms.map((t) => t.y + t.height),
            );
            getNewY = (t) => maxBottom - t.height;
            break;
          }
        }

        return prev.map((l) => {
          if (!ids.includes(l.id)) return l;
          const newTransform = { ...l.transform };
          if (getNewX) newTransform.x = getNewX(l.transform);
          if (getNewY) newTransform.y = getNewY(l.transform);
          return { ...l, transform: newTransform };
        });
      });
    },
    [],
  );

  // Export handlers
  const handleDownloadPng = useCallback(() => {
    const exportCanvas = renderExportCanvas();
    const url = exportCanvas.toDataURL('image/png');
    triggerDownload(url, 'ogp-editor-output.png');
  }, [renderExportCanvas]);

  const handleDownloadJson = useCallback(() => {
    const config = buildEditorConfig();
    if (!config) return;
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'ogp-editor-config.json');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [buildEditorConfig]);

  const handleCopyJson = useCallback(() => {
    const config = buildEditorConfig();
    if (!config) return;
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => {
        setCopyFeedback(true);
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(
          () => setCopyFeedback(false),
          1500,
        );
      })
      .catch(() => {
        /* clipboard denied */
      });
  }, [buildEditorConfig]);

  // JSON Import
  const handleImportJson = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const config = parseOgpEditorConfig(reader.result as string);
          const newLayers = config.layers.map((l) => ({
            ...l,
            id: crypto.randomUUID(),
          }));
          setLayers(newLayers);
          setSelectedIds([]);
          setFrameConfig(config.frame ?? null);

          // Load fonts for text layers (with loading state tracking)
          for (const l of newLayers) {
            if (l.type === 'text') {
              trackFontLoad(l.fontFamily);
            }
          }

          // Load images for image layers
          for (const l of newLayers) {
            if (l.type === 'image') {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              const layerId = l.id;
              img.onload = () => {
                loadedImagesRef.current.set(layerId, img);
                // Trigger re-render by updating layers
                setLayers((prev) => [...prev]);
              };
              img.src = l.src;
            }
          }
        } catch (err) {
          console.error('Failed to import JSON:', err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [trackFontLoad]);

  return (
    <div className="ogp-editor">
      <div className="ogp-editor-toolbar">
        <span className="ogp-editor-title">OGP Editor</span>
        <div className="ogp-editor-toolbar-actions">
          <button
            className="btn ogp-editor-btn"
            onClick={handleDownloadPng}
          >
            Download PNG
          </button>
          <button
            className="btn ogp-editor-btn"
            onClick={handleDownloadJson}
          >
            Download JSON
          </button>
          <button
            className="btn ogp-editor-btn"
            onClick={handleCopyJson}
          >
            {copyFeedback ? 'Copied!' : 'Copy JSON'}
          </button>
          <button className="btn ogp-editor-btn-exit" onClick={onExit}>
            Exit Editor
          </button>
        </div>
      </div>
      <div className="ogp-editor-workspace">
        <div className="ogp-editor-canvas-area">
          <canvas
            ref={canvasRef}
            width={outputWidth}
            height={outputHeight}
            onMouseDown={handleCanvasMouseDown}
          />
        </div>
        <OgpEditorLayerPanel
          layers={layers}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onUpdate={handleLayerUpdate}
          onDelete={handleLayerDelete}
          onReorder={handleReorder}
          onAddImage={handleAddImage}
          onAddText={handleAddText}
          onImportJson={handleImportJson}
          onAlignLayers={handleAlignLayers}
          gridConfig={gridConfig}
          onGridConfigChange={setGridConfig}
          frameConfig={frameConfig}
          onFrameConfigChange={setFrameConfig}
        />
      </div>
    </div>
  );
}
