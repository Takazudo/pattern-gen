import { useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import { useCopyToClipboard } from '../../../hooks/use-copy-to-clipboard';
import { CHANGE_EVENT } from '../../vim-settings/use-styleguide-settings';

interface EditableCodeProps {
  code: string;
  language: string;
  onChange?: (code: string) => void;
}

/**
 * Lazily load CodeMirror and its extensions. Returns everything needed
 * to create an EditorView so the heavy bundle is never pulled during SSR.
 */
async function loadCodeMirror(language: string) {
  const [
    { EditorView, keymap, lineNumbers },
    { EditorState },
    { oneDark },
    { defaultKeymap },
    { tailwindCompletion },
    { getVimExtensions, syncVimClipboard, applyVimrc },
    { setupVimClipboard, teardownVimClipboard },
  ] = await Promise.all([
    import('@codemirror/view'),
    import('@codemirror/state'),
    import('@codemirror/theme-one-dark'),
    import('@codemirror/commands'),
    import('../../code-panel/tw-completion'),
    import('../../vim-settings/vim-mode-extension'),
    import('../../vim-settings/vim-clipboard'),
  ]);

  let langExtension;
  switch (language) {
    case 'css':
      langExtension = (await import('@codemirror/lang-css')).css();
      break;
    case 'javascript':
    case 'js':
    case 'tsx':
      langExtension = (await import('@codemirror/lang-javascript')).javascript({
        jsx: language === 'tsx',
        typescript: language === 'tsx',
      });
      break;
    default:
      langExtension = (await import('@codemirror/lang-html')).html();
      break;
  }

  return {
    EditorView,
    EditorState,
    oneDark,
    langExtension,
    keymap,
    lineNumbers,
    defaultKeymap,
    tailwindCompletion,
    getVimExtensions,
    syncVimClipboard,
    setupVimClipboard,
    teardownVimClipboard,
    applyVimrc,
  };
}

export default function EditableCode({ code, language, onChange }: EditableCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const getEditorText = useCallback(() => viewRef.current?.state.doc.toString() ?? code, [code]);
  const [copied, handleCopy] = useCopyToClipboard(getEditorText);

  // Create the editor once on mount (and re-create on settings change)
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    const abort = new AbortController();

    loadCodeMirror(language).then(
      ({
        EditorView,
        EditorState,
        oneDark,
        langExtension,
        keymap,
        lineNumbers,
        defaultKeymap,
        tailwindCompletion,
        getVimExtensions,
        syncVimClipboard,
        setupVimClipboard,
        teardownVimClipboard,
        applyVimrc,
      }) => {
        if (destroyed || !containerRef.current) return;

        function buildEditor(container: HTMLElement, doc: string) {
          const updateListener = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString());
            }
          });

          const state = EditorState.create({
            doc,
            extensions: [
              ...getVimExtensions(),
              keymap.of(defaultKeymap),
              lineNumbers(),
              langExtension,
              oneDark,
              updateListener,
              EditorView.lineWrapping,
              tailwindCompletion(),
            ],
          });

          const view = new EditorView({ state, parent: container });

          // Always teardown first — the previous editor DOM is about to be
          // destroyed, so old focusin listeners must go before re-setup.
          teardownVimClipboard();
          syncVimClipboard(setupVimClipboard, teardownVimClipboard, view.dom);

          // Apply vimrc commands
          applyVimrc(view);

          return view;
        }

        viewRef.current = buildEditor(containerRef.current!, code);

        // Re-create editor when vim settings change
        window.addEventListener(
          CHANGE_EVENT,
          () => {
            if (!containerRef.current) return;
            const currentDoc = viewRef.current?.state.doc.toString() ?? code;
            viewRef.current?.destroy();
            viewRef.current = buildEditor(containerRef.current, currentDoc);
          },
          { signal: abort.signal },
        );
      },
    );

    return () => {
      destroyed = true;
      abort.abort();
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // language is static per block; code is the initial value only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sync external code prop changes (e.g. reset) into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
    }
  }, [code]);

  return (
    <div className="relative">
      <div ref={containerRef} className="zd-editable-code overflow-auto" />
      <button
        type="button"
        aria-label="Copy code to clipboard"
        className="absolute top-hsp-xs right-hsp-xs px-hsp-sm py-hsp-2xs text-caption rounded border border-muted bg-surface text-muted cursor-pointer opacity-70 hover:opacity-100 transition-opacity duration-150"
        onClick={handleCopy}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
