import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { parseComposerConfig, hashString, createRandom } from '@takazudo/pattern-gen-core';
import type {
  OgpConfig,
  ComposerConfig,
  EditorLayer,
  FrameConfig,
  ImageLayerData,
  TextLayerData,
  LayerTransform,
} from '@takazudo/pattern-gen-core';
import { framesByName } from '@takazudo/pattern-gen-generators';
import { removeBackgroundViaWorker, applyThreshold } from '@takazudo/pattern-gen-image-processor';
import type { ProcessedImage } from '@takazudo/pattern-gen-image-processor';
import { ComposerLayerPanel } from './composer-layer-panel.js';
import { ImageTracePreview } from './image-trace-preview.js';
import { useComposerHistory } from './use-composer-history.js';
import { loadGoogleFont, isFontLoaded } from './composer-font-picker.js';
import { downloadBlob, triggerDownload } from '../utils/trigger-download.js';
import { renderTextLayer, drawSelectionHandles, drawGrid, HANDLE_SIZE, LOADING_FONT_DIM_FACTOR } from './composer-canvas-utils.js';
import { getGridPositions, snapToNearest, snapTransform, MIN_LAYER_SIZE } from './composer-grid-utils.js';
import { computeAlignment, type AlignmentType } from './composer-align-utils.js';
export type { AlignmentType } from './composer-align-utils.js';
import './overlay-shared.css';
import './composer.css';

/* ── Props ── */

interface ComposerProps {
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

/* ── Helpers (kept local — not worth extracting) ── */

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

/* ── Main Component ── */

export function Composer({
  backgroundImage,
  backgroundConfig,
  outputWidth,
  outputHeight,
  onExit,
}: ComposerProps) {
  const history = useComposerHistory({
    layers: [],
    frameConfig: null,
    gridConfig: { vDivide: 2, hDivide: 2, snap: false, visible: false, lineColor: 'rgba(180, 180, 180, 0.5)' },
  });
  const { layers, frameConfig, gridConfig } = history.state;

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showImageTrace, setShowImageTrace] = useState(false);
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  // Helpers to update document state through history
  const historyRef = useRef(history.state);
  historyRef.current = history.state;

  const setLayers = history.setLayers;

  const setGridConfig = useCallback(
    (config: GridConfig) => {
      const current = historyRef.current;
      history.set({ ...current, gridConfig: config });
      history.commit();
    },
    [history.set, history.commit],
  );

  const setFrameConfig = useCallback(
    (config: FrameConfig | null) => {
      const current = historyRef.current;
      history.set({ ...current, frameConfig: config });
      history.commit();
    },
    [history.set, history.commit],
  );

  const setFrameConfigContinuous = useCallback(
    (config: FrameConfig | null) => {
      const current = historyRef.current;
      history.set({ ...current, frameConfig: config });
      history.commitContinuous();
    },
    [history.set, history.commitContinuous],
  );

  const flushFrameConfigContinuous = useCallback(() => {
    history.flushContinuous();
  }, [history.flushContinuous]);

  const [dragState, setDragState] = useState<
    | {
        type: 'move';
        id: string;
        startX: number;
        startY: number;
        startTransform: LayerTransform;
      }
    | {
        type: 'resize';
        id: string;
        startX: number;
        startY: number;
        startTransform: LayerTransform;
        handle: ResizeHandle;
      }
    | {
        type: 'group-move';
        ids: string[];
        startX: number;
        startY: number;
        startTransforms: Record<string, LayerTransform>;
      }
    | null
  >(null);
  const [isAltResize, setIsAltResize] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImagesRef = useRef(new Map<string, HTMLImageElement>());
  const processedImagesRef = useRef(new Map<string, ProcessedImage>());
  const [processingLayers, setProcessingLayers] = useState<Set<string>>(new Set());
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
      processed: Map<string, ProcessedImage>,
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
          const t = layer.transform;
          const proc = processed.get(layer.id);
          if (proc && layer.bgRemoval?.enabled) {
            // Draw with background removed
            const thresholded = applyThreshold(proc, { threshold: layer.bgRemoval.threshold });
            const tmpCanvas = new OffscreenCanvas(thresholded.width, thresholded.height);
            const tmpCtx = tmpCanvas.getContext('2d');
            if (tmpCtx) {
              tmpCtx.putImageData(thresholded, 0, 0);
              ctx.drawImage(tmpCanvas, t.x, t.y, t.width, t.height);
            }
          } else {
            const img = images.get(layer.id)!;
            ctx.drawImage(img, t.x, t.y, t.width, t.height);
          }
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

    drawLayers(ctx, backgroundImage, layers, loadedImagesRef.current, processedImagesRef.current, frameConfig, loadingFonts);

    // Draw selection handles for all selected layers
    for (const id of selectedIds) {
      const layer = layers.find((l) => l.id === id);
      if (layer) drawSelectionHandles(ctx, layer.transform);
    }

    // Draw center indicator when Alt+resize is active
    const currentDrag = dragStateRef.current;
    if (isAltResize && currentDrag?.type === 'resize') {
      const layer = layers.find((l) => l.id === currentDrag.id);
      if (layer) {
        const t = layer.transform;
        const cx = t.x + t.width / 2;
        const cy = t.y + t.height / 2;
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw grid overlay on top
    if (
      gridConfig.visible &&
      (gridConfig.vDivide > 1 || gridConfig.hDivide > 1)
    ) {
      drawGrid(ctx, xGridPositions, yGridPositions, gridConfig.lineColor, outputWidth, outputHeight);
    }
  }, [layers, backgroundImage, selectedIds, drawLayers, gridConfig, xGridPositions, yGridPositions, loadingFonts, frameConfig, isAltResize]);

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
    drawLayers(ctx, backgroundImage, layers, loadedImagesRef.current, processedImagesRef.current, frameConfig);
    return exportCanvas;
  }, [layers, backgroundImage, drawLayers, frameConfig, outputWidth, outputHeight]);

  // Build editor config JSON
  const buildEditorConfig = useCallback((): ComposerConfig | null => {
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
          } else if (selectedIds.length > 1 && selectedIds.includes(layer.id)) {
            // Start group drag for all selected layers
            const selectedSet = new Set(selectedIds);
            const startTransforms = Object.fromEntries(
              layers
                .filter((l) => selectedSet.has(l.id))
                .map((l) => [l.id, { ...l.transform }]),
            );
            setDragState({
              type: 'group-move',
              ids: [...selectedIds],
              startX: x,
              startY: y,
              startTransforms,
            });
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

      if (drag.type === 'move') {
        const st = drag.startTransform;
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
      } else if (drag.type === 'group-move') {
        const grid = gridConfigRef.current;
        let finalDx = dx;
        let finalDy = dy;

        if (grid.snap && drag.ids.length > 0) {
          const anchorSt = drag.startTransforms[drag.ids[0]];
          if (anchorSt) {
            const snapped = snapTransform(
              { x: anchorSt.x + dx, y: anchorSt.y + dy, width: anchorSt.width, height: anchorSt.height },
              xGridRef.current,
              yGridRef.current,
            );
            finalDx = snapped.x - anchorSt.x;
            finalDy = snapped.y - anchorSt.y;
          }
        }

        setLayers((prev) =>
          prev.map((l) => {
            const st = drag.startTransforms[l.id];
            if (!st) return l;
            return {
              ...l,
              transform: { ...l.transform, x: st.x + finalDx, y: st.y + finalDy },
            };
          }),
        );
      } else if (drag.type === 'resize' && drag.handle) {
        const st = drag.startTransform;
        const grid = gridConfigRef.current;
        const altKey = e.altKey;
        setIsAltResize(altKey);
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

            // Shift+drag: lock to start aspect ratio
            if (e.shiftKey) {
              const startAspect = st.width / st.height;
              newT.height = newT.width / startAspect;
              if (newT.height < MIN_LAYER_SIZE) {
                newT.height = MIN_LAYER_SIZE;
                newT.width = newT.height * startAspect;
              }
              // Re-anchor for handles that move the origin
              if (drag.handle === 'nw' || drag.handle === 'ne') {
                newT.y = st.y + st.height - newT.height;
              }
              if (drag.handle === 'nw' || drag.handle === 'sw') {
                newT.x = st.x + st.width - newT.width;
              }
            }

            // Center-anchored resize when Alt is held
            if (altKey) {
              const centerX = st.x + st.width / 2;
              const centerY = st.y + st.height / 2;
              const dw = newT.width - st.width;
              const dh = newT.height - st.height;
              newT.width = Math.max(MIN_LAYER_SIZE, st.width + dw * 2);
              newT.height = Math.max(MIN_LAYER_SIZE, st.height + dh * 2);
              newT.x = centerX - newT.width / 2;
              newT.y = centerY - newT.height / 2;
            }

            // Snap resize edges to grid (skip when center-anchored to preserve symmetry)
            if (grid.snap && !altKey) {
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
      if (dragStateRef.current) {
        history.commit();
      }
      setDragState(null);
      setIsAltResize(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [getCanvasCoords, history.commit]);

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
          history.commit();
        };
        img.src = reader.result as string;

        setLayers((prev) => [...prev, newLayer]);
        setSelectedIds([id]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [history.commit]);

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
    history.commit();
  }, [trackFontLoad, history.commit]);

  const handleLayerUpdate = useCallback(
    (id: string, updates: Partial<EditorLayer>) => {
      // Track font loading when fontFamily changes
      if ('fontFamily' in updates && typeof updates.fontFamily === 'string') {
        trackFontLoad(updates.fontFamily);
      }

      // If image src changed, reload the HTMLImageElement and clear processed cache
      if ('src' in updates && typeof updates.src === 'string') {
        processedImagesRef.current.delete(id);
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
      history.commit();
    },
    [trackFontLoad, history.commit],
  );

  const handleLayerUpdateContinuous = useCallback(
    (id: string, updates: Partial<EditorLayer>) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id ? ({ ...l, ...updates } as EditorLayer & { id: string }) : l,
        ),
      );
      history.commitContinuous();
    },
    [history.commitContinuous],
  );

  const handleLayerCommitContinuous = useCallback(() => {
    history.flushContinuous();
  }, [history.flushContinuous]);

  // Toggle bg removal on an image layer — runs ML processing
  const handleBgRemovalToggle = useCallback(
    async (id: string, enabled: boolean) => {
      if (!enabled) {
        // Just disable — keep cached data for quick re-enable
        setLayers((prev) =>
          prev.map((l) =>
            l.id === id && l.type === 'image'
              ? { ...l, bgRemoval: { enabled: false, threshold: l.bgRemoval?.threshold ?? 0 } }
              : l,
          ),
        );
        history.commit();
        return;
      }

      // Enable bg removal
      const layer = layersRef.current.find((l) => l.id === id);
      if (!layer || layer.type !== 'image') return;

      // If already processed, just enable
      if (processedImagesRef.current.has(id)) {
        setLayers((prev) =>
          prev.map((l) =>
            l.id === id && l.type === 'image'
              ? { ...l, bgRemoval: { enabled: true, threshold: l.bgRemoval?.threshold ?? 0 } }
              : l,
          ),
        );
        history.commit();
        return;
      }

      // Run ML background removal
      setProcessingLayers((prev) => new Set(prev).add(id));
      try {
        // Convert data URI to Blob for the removeBackground API
        const res = await fetch(layer.src);
        const blob = await res.blob();
        const processed = await removeBackgroundViaWorker(blob);
        processedImagesRef.current.set(id, processed);
        setLayers((prev) =>
          prev.map((l) =>
            l.id === id && l.type === 'image'
              ? { ...l, bgRemoval: { enabled: true, threshold: l.bgRemoval?.threshold ?? 0 } }
              : l,
          ),
        );
        history.commit();
      } catch (err) {
        console.error('Background removal failed:', err);
        alert(`Background removal failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setProcessingLayers((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [history.commit],
  );

  const handleBgThresholdChange = useCallback(
    (id: string, threshold: number) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id && l.type === 'image' && l.bgRemoval
            ? { ...l, bgRemoval: { ...l.bgRemoval, threshold } }
            : l,
        ),
      );
      history.commitContinuous();
    },
    [history.commitContinuous],
  );

  const handleBgThresholdCommit = useCallback(() => {
    history.flushContinuous();
  }, [history.flushContinuous]);

  const handleLayerDelete = useCallback(
    (id: string) => {
      history.flushContinuous();
      setLayers((prev) => prev.filter((l) => l.id !== id));
      loadedImagesRef.current.delete(id);
      processedImagesRef.current.delete(id);
      setSelectedIds((prev) => prev.filter((sid) => sid !== id));
      history.commit();
    },
    [history.flushContinuous, history.commit],
  );

  const handleDuplicateLayer = useCallback(
    (id: string) => {
      history.flushContinuous();
      const newId = crypto.randomUUID();
      setLayers((prev) => {
        const idx = prev.findIndex((l) => l.id === id);
        if (idx === -1) return prev;
        const source = prev[idx];
        const clone: EditorLayer & { id: string } = {
          ...source,
          id: newId,
          name: `${source.name} copy`,
          transform: {
            ...source.transform,
            x: source.transform.x + 20,
            y: source.transform.y + 20,
          },
        };
        // Copy image refs for image layers
        if (source.type === 'image') {
          const loadedImg = loadedImagesRef.current.get(id);
          if (loadedImg) loadedImagesRef.current.set(newId, loadedImg);
          const processedImg = processedImagesRef.current.get(id);
          if (processedImg) processedImagesRef.current.set(newId, processedImg);
        }
        const next = [...prev];
        next.splice(idx + 1, 0, clone);
        return next;
      });
      setSelectedIds([newId]);
      history.commit();
    },
    [history.flushContinuous, history.commit],
  );

  // Cmd+D to duplicate selected layer
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'd' && e.key !== 'D') return;
      if (!e.metaKey && !e.ctrlKey) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const ids = selectedIdsRef.current;
      if (ids.length === 0) return;
      e.preventDefault();
      handleDuplicateLayer(ids[0]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDuplicateLayer]);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      history.flushContinuous();
      setLayers((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      history.commit();
    },
    [history.flushContinuous, history.commit],
  );

  // Alignment handler
  const handleAlignLayers = useCallback(
    (ids: string[], alignment: AlignmentType) => {
      history.flushContinuous();
      setLayers((prev) => {
        const aligned = computeAlignment(prev, ids, alignment);
        if (!aligned) return prev;
        return prev.map((l) => {
          const newTransform = aligned.get(l.id);
          return newTransform ? { ...l, transform: newTransform } : l;
        });
      });
      history.commit();
    },
    [history.flushContinuous, history.commit],
  );

  // Export handlers
  const handleDownloadPng = useCallback(() => {
    const exportCanvas = renderExportCanvas();
    const url = exportCanvas.toDataURL('image/png');
    triggerDownload(url, 'composer-output.png');
  }, [renderExportCanvas]);

  const handleDownloadJson = useCallback(() => {
    const config = buildEditorConfig();
    if (!config) return;
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'composer-config.json');
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

  // Cmd+Delete shortcut — delete all selected layers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault();
        for (const id of selectedIds) {
          handleLayerDelete(id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, handleLayerDelete]);

  // Click-outside to close settings popover
  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.composer-settings-popover') && !target.closest('.composer-settings-btn')) {
        setShowSettings(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

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
          const config = parseComposerConfig(reader.result as string);
          const newLayers = config.layers.map((l) => ({
            ...l,
            id: crypto.randomUUID(),
          }));
          const current = historyRef.current;
          history.set({
            ...current,
            layers: newLayers,
            frameConfig: config.frame ?? null,
          });
          setSelectedIds([]);
          history.commit();

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
  }, [trackFontLoad, history.set, history.commit]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: don't fire when focus is in form elements
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history.undo, history.redo]);

  return (
    <div className="overlay-root composer">
      <div className="overlay-toolbar composer-toolbar">
        <span className="composer-title">Composer</span>
        <div className="composer-history-actions">
          <button
            className="btn composer-history-btn"
            onClick={history.undo}
            disabled={!history.canUndo}
            title="Undo (Cmd+Z)"
            aria-label="Undo"
          >
            &#x21A9;
          </button>
          <button
            className="btn composer-history-btn"
            onClick={history.redo}
            disabled={!history.canRedo}
            title="Redo (Cmd+Shift+Z)"
            aria-label="Redo"
          >
            &#x21AA;
          </button>
        </div>
        <div className="composer-toolbar-actions">
          <button
            className="btn composer-btn"
            onClick={handleDownloadPng}
          >
            Download PNG
          </button>
          <button
            className="btn composer-btn"
            onClick={handleDownloadJson}
          >
            Download JSON
          </button>
          <button
            className="btn composer-btn"
            onClick={handleCopyJson}
          >
            {copyFeedback ? 'Copied!' : 'Copy JSON'}
          </button>
          <button
            className="btn composer-btn"
            onClick={() => setShowImageTrace(true)}
          >
            Image Trace
          </button>
          <button
            className="btn composer-settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings & Shortcuts"
            aria-label="Settings"
          >
            ⚙
          </button>
          <button className="btn composer-btn-exit" onClick={onExit}>
            Exit Editor
          </button>
        </div>
        {showSettings && (
          <div className="composer-settings-popover">
            <div className="composer-settings-title">Keyboard Shortcuts</div>
            <div className="composer-settings-shortcuts">
              <div className="composer-shortcut-row">
                <span className="composer-shortcut-action">Undo</span>
                <kbd className="composer-shortcut-key">⌘Z</kbd>
              </div>
              <div className="composer-shortcut-row">
                <span className="composer-shortcut-action">Redo</span>
                <kbd className="composer-shortcut-key">⌘⇧Z</kbd>
              </div>
              <div className="composer-shortcut-row">
                <span className="composer-shortcut-action">Delete</span>
                <kbd className="composer-shortcut-key">⌘⌫</kbd>
              </div>
              <div className="composer-shortcut-row">
                <span className="composer-shortcut-action">Duplicate</span>
                <kbd className="composer-shortcut-key">⌘D</kbd>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="overlay-workspace composer-workspace">
        <div className="composer-canvas-area">
          <canvas
            ref={canvasRef}
            width={outputWidth}
            height={outputHeight}
            onMouseDown={handleCanvasMouseDown}
          />
        </div>
        <ComposerLayerPanel
          layers={layers}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onUpdate={handleLayerUpdate}
          onUpdateContinuous={handleLayerUpdateContinuous}
          onCommitContinuous={handleLayerCommitContinuous}
          onDelete={handleLayerDelete}
          onDuplicate={handleDuplicateLayer}
          onReorder={handleReorder}
          onAddImage={handleAddImage}
          onAddText={handleAddText}
          onImportJson={handleImportJson}
          onAlignLayers={handleAlignLayers}
          gridConfig={gridConfig}
          onGridConfigChange={setGridConfig}
          frameConfig={frameConfig}
          onFrameConfigChange={setFrameConfig}
          onFrameConfigChangeContinuous={setFrameConfigContinuous}
          onFrameConfigCommitContinuous={flushFrameConfigContinuous}
          processingLayers={processingLayers}
          onBgRemovalToggle={handleBgRemovalToggle}
          onBgThresholdChange={handleBgThresholdChange}
          onBgThresholdCommit={handleBgThresholdCommit}
        />
      </div>
      {showImageTrace && (
        <ImageTracePreview
          getSourceCanvas={renderExportCanvas}
          onClose={() => setShowImageTrace(false)}
        />
      )}
    </div>
  );
}
