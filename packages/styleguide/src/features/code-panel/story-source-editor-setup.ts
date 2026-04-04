import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { tailwindCompletion } from './tw-completion';
import { getVimExtensions, syncVimClipboard, applyVimrc } from '../vim-settings/vim-mode-extension';
import { setupVimClipboard, teardownVimClipboard } from '../vim-settings/vim-clipboard';

export function createEditorView(
  doc: string,
  parent: HTMLElement,
  opts?: { onChange?: (content: string) => void; filename?: string },
): EditorView {
  const isCss = opts?.filename?.endsWith('.css');
  const langExtension = isCss ? css() : javascript({ jsx: true, typescript: true });

  const extensions = [
    ...getVimExtensions(),
    keymap.of(defaultKeymap),
    lineNumbers(),
    langExtension,
    oneDark,
    EditorView.lineWrapping,
    tailwindCompletion(),
  ];

  if (opts?.onChange) {
    const onChangeFn = opts.onChange;
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeFn(update.state.doc.toString());
        }
      }),
    );
  }

  const view = new EditorView({
    state: EditorState.create({ doc, extensions }),
    parent,
  });

  // Always teardown first — the previous editor DOM is about to be
  // destroyed, so old focusin listeners must go before re-setup.
  teardownVimClipboard();
  syncVimClipboard(setupVimClipboard, teardownVimClipboard, view.dom);

  // Apply vimrc commands
  applyVimrc(view);

  return view;
}
