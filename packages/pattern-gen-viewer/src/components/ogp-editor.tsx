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
  onExit: () => void;
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

/* ── Main Component ── */

export function OgpEditor({
  backgroundImage,
  backgroundConfig,
  onExit,
}: OgpEditorProps) {
  const [layers, setLayers] = useState<(EditorLayer & { id: string })[]>(
    [],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
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

    // Draw selection handles for all selected layers
    for (const id of selectedIds) {
      const layer = layers.find((l) => l.id === id);
      if (layer) drawSelectionHandles(ctx, layer.transform);
    }
  }, [layers, backgroundImage, selectedIds, drawLayers]);

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
        setLayers((prev) =>
          prev.map((l) =>
            l.id === drag.id
              ? {
                  ...l,
                  transform: {
                    ...l.transform,
                    x: st.x + dx,
                    y: st.y + dy,
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
        setSelectedIds([id]);
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
          setSelectedIds([]);

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
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onUpdate={handleLayerUpdate}
          onDelete={handleLayerDelete}
          onReorder={handleReorder}
          onAddImage={handleAddImage}
          onAddText={handleAddText}
          onImportJson={handleImportJson}
          onAlignLayers={handleAlignLayers}
        />
      </div>
    </div>
  );
}
