import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { CHANGE_EVENT } from '../vim-settings/use-styleguide-settings';

interface StorySourceEditorProps {
  source: string;
  filename?: string;
  onChange?: (filename: string, content: string) => void;
}

let cmPromise: Promise<typeof import('./story-source-editor-setup')> | null = null;

function getCmSetup() {
  if (!cmPromise) {
    cmPromise = import('./story-source-editor-setup').catch((err) => {
      cmPromise = null;
      throw err;
    });
  }
  return cmPromise;
}

/**
 * CodeMirror editor for viewing story source code.
 * Intentionally editable so users can tweak code before copying
 * to an AI assistant for communication (edit → copy → paste to AI).
 */
export default function StorySourceEditor({ source, filename, onChange }: StorySourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [loading, setLoading] = useState(true);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const filenameRef = useRef(filename);
  filenameRef.current = filename;

  const cmOnChange = useCallback((content: string) => {
    if (filenameRef.current && onChangeRef.current) {
      onChangeRef.current(filenameRef.current, content);
    }
  }, []);

  const getEditorText = useCallback(
    () => viewRef.current?.state.doc.toString() ?? source,
    [source],
  );
  const [copied, handleCopy] = useCopyToClipboard(getEditorText);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setLoading(true);
    let destroyed = false;

    const abort = new AbortController();

    getCmSetup()
      .then(({ createEditorView }) => {
        if (destroyed) return;
        // Clear any previously mounted editor from the container
        el.textContent = '';
        const cmOpts = { onChange: cmOnChange, filename };
        const view = createEditorView(source, el, cmOpts);
        viewRef.current = view;
        setLoading(false);

        // Re-create editor when vim settings change
        window.addEventListener(
          CHANGE_EVENT,
          () => {
            if (!el) return;
            const currentDoc = viewRef.current?.state.doc.toString() ?? source;
            viewRef.current?.destroy();
            el.textContent = '';
            viewRef.current = createEditorView(currentDoc, el, cmOpts);
          },
          { signal: abort.signal },
        );
      })
      .catch(() => {
        setLoading(false);
      });

    return () => {
      destroyed = true;
      abort.abort();
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [source, cmOnChange]);

  return (
    <div className="relative">
      <div className="absolute top-vsp-xs right-hsp-xs z-10">
        <button
          type="button"
          aria-label="Copy code to clipboard"
          className="px-hsp-xs py-vsp-2xs text-xs border rounded-lg cursor-pointer transition-colors duration-150 leading-snug bg-surface text-muted border-p6 hover:text-fg"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {loading && (
        <pre className="m-0 p-hsp-sm bg-p0 text-xs text-muted font-mono whitespace-pre-wrap overflow-x-auto">
          {source}
        </pre>
      )}
      <div ref={containerRef} className={loading ? 'hidden' : ''} />
    </div>
  );
}
