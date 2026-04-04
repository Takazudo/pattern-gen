import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { registerIframe } from '../../lib/iframe-registry';
import { ControlsPanel } from './controls-panel';
import type { ControlsMap } from './control-types';
import { humanize } from './preview-utils';

type Viewport = { label: string; width: string };

const VIEWPORTS: Viewport[] = [
  { label: 'Mobile', width: '320px' },
  { label: 'Tablet', width: '768px' },
  { label: 'Full', width: '100%' },
];

const DEFAULT_VIEWPORT = VIEWPORTS.findIndex((vp) => vp.label === 'Full');

interface VariantPreviewProps {
  src: string;
  name: string;
  controls?: string;
}

export function VariantPreview({ src, name, controls: controlsJson }: VariantPreviewProps) {
  const [activeViewport, setActiveViewport] = useState(DEFAULT_VIEWPORT);
  const [iframeHeight, setIframeHeight] = useState(200);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const parsedControls = useMemo<ControlsMap | undefined>(() => {
    if (!controlsJson) return undefined;
    try {
      return JSON.parse(controlsJson) as ControlsMap;
    } catch {
      return undefined;
    }
  }, [controlsJson]);

  const sendPropsToIframe = useCallback((props: Record<string, unknown>) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'styleguide:updateProps', props }, '*');
  }, []);

  const syncHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (doc?.body) {
        const h = doc.body.scrollHeight;
        if (h > 0) setIframeHeight(Math.max(h + 16, 200));
      }
    } catch {
      // cross-origin — keep default
    }
  }, []);

  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const roRef = useRef<ResizeObserver | null>(null);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    registerIframe(iframe);
    // Measure multiple times as client:only components render asynchronously
    setTimeout(syncHeight, 300);
    setTimeout(syncHeight, 1000);
    setTimeout(syncHeight, 2000);

    // Disconnect previous observer before creating a new one
    roRef.current?.disconnect();
    roRef.current = null;

    // Watch for content size changes via ResizeObserver
    try {
      const body = iframe.contentDocument?.body;
      if (body) {
        const ro = new ResizeObserver(() => syncHeight());
        ro.observe(body);
        roRef.current = ro;
      }
    } catch {
      // cross-origin
    }
  }, [syncHeight]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
      roRef.current?.disconnect();
      roRef.current = null;
    };
  }, [handleLoad]);

  // Re-measure height when viewport changes (content reflows)
  useEffect(() => {
    if (manualHeight !== null) return;
    const id = setTimeout(syncHeight, 150);
    return () => clearTimeout(id);
  }, [activeViewport, syncHeight, manualHeight]);

  // Drag-to-resize handle
  const onDragStart = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      const h = manualHeight ?? iframeHeight;
      dragRef.current = { startY: e.clientY, startH: h };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientY - dragRef.current.startY;
        setManualHeight(Math.max(100, dragRef.current.startH + delta));
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [iframeHeight, manualHeight],
  );

  const containerWidth = VIEWPORTS[activeViewport].width;

  return (
    <section className="border border-p6 rounded-lg overflow-hidden">
      {/* Title bar with viewport buttons */}
      <div className="flex items-center justify-between px-hsp-sm py-vsp-xs bg-surface border-b border-p6 gap-hsp-xs flex-wrap">
        <span className="text-sm font-sans font-normal text-muted">{humanize(name)}</span>
        <div className="flex gap-hsp-2xs items-center" role="group" aria-label="Viewport size">
          {manualHeight !== null && (
            <button
              type="button"
              className="px-hsp-xs py-vsp-2xs text-xs border rounded-lg cursor-pointer bg-transparent text-muted border-p6 hover:text-fg transition-colors duration-150 leading-snug"
              onClick={() => {
                setManualHeight(null);
                setTimeout(syncHeight, 50);
              }}
              title="Reset to auto height"
            >
              Auto
            </button>
          )}
          {VIEWPORTS.map((vp, i) => (
            <button
              key={vp.label}
              type="button"
              className={`px-hsp-xs py-vsp-2xs text-xs border rounded-lg cursor-pointer transition-[background,color,border-color] duration-150 leading-snug ${
                i === activeViewport
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-transparent text-muted border-p6'
              }`}
              aria-pressed={i === activeViewport}
              onClick={() => setActiveViewport(i)}
            >
              {vp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview area */}
      <div className="bg-p0 p-hsp-sm">
        <div className="max-w-full mx-auto" style={{ width: containerWidth }}>
          <iframe
            ref={iframeRef}
            src={src}
            title={`Preview: ${humanize(name)}`}
            className="block w-full border-none bg-bg rounded-sm"
            style={{ height: manualHeight ?? iframeHeight }}
          />
          {/* Drag handle for manual resize */}
          <div
            className="h-[8px] cursor-row-resize flex items-center justify-center group"
            onMouseDown={onDragStart}
            title="Drag to resize"
          >
            <div className="w-[40px] h-[3px] rounded bg-p6 group-hover:bg-accent transition-colors" />
          </div>
        </div>
      </div>

      {/* Controls panel */}
      {parsedControls && <ControlsPanel controls={parsedControls} onChange={sendPropsToIframe} />}
    </section>
  );
}
