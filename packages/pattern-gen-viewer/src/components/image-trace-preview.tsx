import { useState, useEffect, useRef, useCallback } from 'react';
import {
  traceImageData,
  DEFAULT_TRACE_OPTIONS,
  type ImageTraceOptions,
} from '../utils/image-trace.js';
import './image-trace-preview.css';

interface ImageTracePreviewProps {
  getSourceCanvas: () => HTMLCanvasElement;
  onClose: () => void;
}

interface ParamDef {
  key: keyof ImageTraceOptions;
  label: string;
  min: number;
  max: number;
  step: number;
}

const PARAM_DEFS: ParamDef[] = [
  { key: 'numberOfColors', label: 'Number of Colors', min: 2, max: 64, step: 1 },
  { key: 'minPathSegments', label: 'Min Path Segments', min: 0, max: 20, step: 1 },
  { key: 'blurRadius', label: 'Blur Radius', min: 0, max: 5, step: 1 },
  { key: 'blurDelta', label: 'Blur Delta', min: 0, max: 1000, step: 10 },
  { key: 'strokeWidth', label: 'Stroke Width', min: 0, max: 5, step: 0.1 },
  { key: 'lineErrorMargin', label: 'Line Error Margin', min: 0, max: 10, step: 0.1 },
  { key: 'curveErrorMargin', label: 'Curve Error Margin', min: 0, max: 10, step: 0.1 },
];

export function ImageTracePreview({ getSourceCanvas, onClose }: ImageTracePreviewProps) {
  const [options, setOptions] = useState<ImageTraceOptions>({ ...DEFAULT_TRACE_OPTIONS });
  const [svgString, setSvgString] = useState<string>('');
  const [isTracing, setIsTracing] = useState(true);
  const imageDataRef = useRef<ImageData | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>);
  const mountedRef = useRef(true);

  // Get image data once on mount
  useEffect(() => {
    const canvas = getSourceCanvas();
    const ctx = canvas.getContext('2d')!;
    imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return () => {
      mountedRef.current = false;
    };
  }, [getSourceCanvas]);

  // Run trace
  const runTrace = useCallback(async (opts: ImageTraceOptions) => {
    if (!imageDataRef.current) return;
    setIsTracing(true);
    try {
      const svg = await traceImageData(imageDataRef.current, opts);
      if (mountedRef.current) {
        setSvgString(svg);
      }
    } finally {
      if (mountedRef.current) {
        setIsTracing(false);
      }
    }
  }, []);

  // Initial trace on mount
  useEffect(() => {
    runTrace(options);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced re-trace when options change (skip initial)
  const initialRef = useRef(true);
  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runTrace(options);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [options, runTrace]);

  const handleOptionChange = useCallback((key: keyof ImageTraceOptions, value: number) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setOptions({ ...DEFAULT_TRACE_OPTIONS });
  }, []);

  const handleDownloadSvg = useCallback(() => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ogp-traced.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svgString]);

  return (
    <div className="image-trace-preview">
      <div className="image-trace-toolbar">
        <span className="image-trace-title">Image Trace Preview</span>
        <div className="image-trace-toolbar-actions">
          <button
            className="btn ogp-editor-btn"
            onClick={handleDownloadSvg}
            disabled={!svgString || isTracing}
          >
            Download SVG
          </button>
          <button className="btn ogp-editor-btn-exit" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
      <div className="image-trace-workspace">
        <div className="image-trace-preview-area">
          {isTracing && !svgString ? (
            <div className="image-trace-loading">Tracing...</div>
          ) : (
            <div
              className="image-trace-svg-container"
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          )}
        </div>
        <div className="image-trace-panel">
          <div className="ogp-panel-section">
            <span className="ogp-props-title">Trace Parameters</span>
            {PARAM_DEFS.map((param) => (
              <div key={param.key} className="image-trace-param">
                <div className="image-trace-param-header">
                  <span className="image-trace-param-label">{param.label}</span>
                  <span className="image-trace-param-value">
                    {options[param.key]}
                  </span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={options[param.key]}
                  onChange={(e) =>
                    handleOptionChange(param.key, parseFloat(e.target.value))
                  }
                />
              </div>
            ))}
            <button className="image-trace-reset-btn" onClick={handleReset}>
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
