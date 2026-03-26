import { useState, useCallback, useRef, useEffect } from 'react';
import { OGP_WIDTH, OGP_HEIGHT } from 'pattern-gen/core/ogp-config';
import type { OgpConfig } from 'pattern-gen/core/ogp-config';
import { parseOgpEditorConfig } from 'pattern-gen/core/ogp-editor-config';
import type {
  OgpEditorConfig,
  EditorLayer,
  ImageLayerData,
  TextLayerData,
  LayerTransform,
} from 'pattern-gen/core/ogp-editor-config';
import { OgpEditorLayerPanel } from './ogp-editor-layer-panel.js';
import { loadGoogleFont } from './ogp-editor-font-picker.js';
import './ogp-editor.css';

/* ── Props ── */

interface OgpEditorProps {
  backgroundImage: ImageBitmap | null;
  backgroundConfig: OgpConfig | null;
  onExit: () => void;
}

/* ── Grid types ── */

export interface GridConfig {
  vDivide: number;
  hDivide: number;
  snap: boolean;
  visible: boolean;
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

  let textX = t.x;
  if (layer.textAlign === 'center') textX = t.x + t.width / 2;
  else if (layer.textAlign === 'right') textX = t.x + t.width;

  for (let i = 0; i < lines.length; i++) {
    const y = t.y + i * lineHeightPx;

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

  // Reset letter spacing
  if (layer.letterSpacing !== 0) {
    (ctx as unknown as Record<string, unknown>).letterSpacing = '0px';
  }
}

function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  t: LayerTransform,
) {
  ctx.save();
  ctx.strokeStyle = 'oklch(90% 0 0)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(t.x, t.y, t.width, t.height);
  ctx.setLineDash([]);

  // Corner handles
  const handleSize = 8;
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'oklch(30% 0 0)';
  ctx.lineWidth = 1;
  const corners = [
    [t.x, t.y],
    [t.x + t.width, t.y],
    [t.x, t.y + t.height],
    [t.x + t.width, t.y + t.height],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(
      cx - handleSize / 2,
      cy - handleSize / 2,
      handleSize,
      handleSize,
    );
    ctx.strokeRect(
      cx - handleSize / 2,
      cy - handleSize / 2,
      handleSize,
      handleSize,
    );
  }
  ctx.restore();
}

const HANDLE_SIZE = 8;

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
  vDivide: number,
  hDivide: number,
) {
  ctx.save();
  ctx.strokeStyle = 'oklch(80% 0 0 / 30%)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let i = 1; i < vDivide; i++) {
    const x = Math.round(OGP_WIDTH * i / vDivide) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, OGP_HEIGHT);
    ctx.stroke();
  }

  for (let i = 1; i < hDivide; i++) {
    const y = Math.round(OGP_HEIGHT * i / hDivide) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(OGP_WIDTH, y);
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
  threshold: number = 10,
): number {
  for (const pos of gridPositions) {
    if (Math.abs(value - pos) <= threshold) {
      return pos;
    }
  }
  return value;
}

function snapTransform(
  t: LayerTransform,
  xPositions: number[],
  yPositions: number[],
  threshold: number = 10,
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
  onExit,
}: OgpEditorProps) {
  const [layers, setLayers] = useState<(EditorLayer & { id: string })[]>(
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    vDivide: 1,
    hDivide: 1,
    snap: false,
    visible: true,
  });
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
        x: (clientX - rect.left) * (OGP_WIDTH / rect.width),
        y: (clientY - rect.top) * (OGP_HEIGHT / rect.height),
      };
    },
    [],
  );

  // Shared layer drawing logic
  const drawLayers = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      bg: ImageBitmap | null,
      layerList: (EditorLayer & { id: string })[],
      images: Map<string, HTMLImageElement>,
    ) => {
      ctx.clearRect(0, 0, OGP_WIDTH, OGP_HEIGHT);
      if (bg) ctx.drawImage(bg, 0, 0, OGP_WIDTH, OGP_HEIGHT);

      for (const layer of layerList) {
        ctx.save();
        ctx.globalAlpha = layer.opacity;

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
    },
    [],
  );

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawLayers(ctx, backgroundImage, layers, loadedImagesRef.current);

    // Draw selection handles for selected layer
    if (selectedId) {
      const selected = layers.find((l) => l.id === selectedId);
      if (selected) drawSelectionHandles(ctx, selected.transform);
    }

    // Draw grid overlay on top
    if (
      gridConfig.visible &&
      (gridConfig.vDivide > 1 || gridConfig.hDivide > 1)
    ) {
      drawGrid(ctx, gridConfig.vDivide, gridConfig.hDivide);
    }
  }, [layers, backgroundImage, selectedId, drawLayers, gridConfig]);

  // Re-render when state changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Render to export canvas (no selection handles)
  const renderExportCanvas = useCallback((): HTMLCanvasElement => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = OGP_WIDTH;
    exportCanvas.height = OGP_HEIGHT;
    const ctx = exportCanvas.getContext('2d')!;
    drawLayers(ctx, backgroundImage, layers, loadedImagesRef.current);
    return exportCanvas;
  }, [layers, backgroundImage, drawLayers]);

  // Build editor config JSON
  const buildEditorConfig = useCallback((): OgpEditorConfig => {
    return {
      version: 1,
      background: backgroundConfig!,
      layers: layers.map(({ id: _id, ...rest }) => rest),
    };
  }, [layers, backgroundConfig]);

  // Mouse handlers
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);

      // Check resize handles on selected layer first
      if (selectedId) {
        const selected = layers.find((l) => l.id === selectedId);
        if (selected) {
          const handle = hitTestHandle(selected.transform, x, y);
          if (handle) {
            setDragState({
              type: 'resize',
              id: selectedId,
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
          setSelectedId(layer.id);
          setDragState({
            type: 'move',
            id: layer.id,
            startX: x,
            startY: y,
            startTransform: { ...layer.transform },
          });
          return;
        }
      }

      // Clicked empty space — deselect
      setSelectedId(null);
    },
    [getCanvasCoords, layers, selectedId],
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
          const xPositions = getGridPositions(OGP_WIDTH, grid.vDivide);
          const yPositions = getGridPositions(OGP_HEIGHT, grid.hDivide);
          const snapped = snapTransform(
            { x: newX, y: newY, width: st.width, height: st.height },
            xPositions,
            yPositions,
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
        setLayers((prev) =>
          prev.map((l) => {
            if (l.id !== drag.id) return l;
            const newT = { ...st };
            switch (drag.handle) {
              case 'se':
                newT.width = Math.max(20, st.width + dx);
                newT.height = Math.max(20, st.height + dy);
                break;
              case 'sw': {
                const newW = Math.max(20, st.width - dx);
                newT.x = st.x + st.width - newW;
                newT.width = newW;
                newT.height = Math.max(20, st.height + dy);
                break;
              }
              case 'ne': {
                const newH = Math.max(20, st.height - dy);
                newT.y = st.y + st.height - newH;
                newT.width = Math.max(20, st.width + dx);
                newT.height = newH;
                break;
              }
              case 'nw': {
                const newW = Math.max(20, st.width - dx);
                const newH = Math.max(20, st.height - dy);
                newT.x = st.x + st.width - newW;
                newT.y = st.y + st.height - newH;
                newT.width = newW;
                newT.height = newH;
                break;
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
        setSelectedId(id);
      };
      reader.readAsDataURL(file);
    };
    input.click();
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
    setSelectedId(id);
    loadGoogleFont('Inter');
  }, []);

  const handleLayerUpdate = useCallback(
    (id: string, updates: Partial<EditorLayer>) => {
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
    [],
  );

  const handleLayerDelete = useCallback(
    (id: string) => {
      setLayers((prev) => prev.filter((l) => l.id !== id));
      loadedImagesRef.current.delete(id);
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
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

  // Export handlers
  const handleDownloadPng = useCallback(() => {
    const exportCanvas = renderExportCanvas();
    const url = exportCanvas.toDataURL('image/png');
    triggerDownload(url, 'ogp-editor-output.png');
  }, [renderExportCanvas]);

  const handleDownloadJson = useCallback(() => {
    const config = buildEditorConfig();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'ogp-editor-config.json');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [buildEditorConfig]);

  const handleCopyJson = useCallback(() => {
    const config = buildEditorConfig();
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
          setSelectedId(null);

          // Load fonts for text layers
          for (const l of newLayers) {
            if (l.type === 'text') {
              loadGoogleFont(l.fontFamily);
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
  }, []);

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
            width={OGP_WIDTH}
            height={OGP_HEIGHT}
            onMouseDown={handleCanvasMouseDown}
          />
        </div>
        <OgpEditorLayerPanel
          layers={layers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdate={handleLayerUpdate}
          onDelete={handleLayerDelete}
          onReorder={handleReorder}
          onAddImage={handleAddImage}
          onAddText={handleAddText}
          onImportJson={handleImportJson}
          gridConfig={gridConfig}
          onGridConfigChange={setGridConfig}
        />
      </div>
    </div>
  );
}
