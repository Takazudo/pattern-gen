import { vim, Vim, getCM } from '@replit/codemirror-vim';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { getStyleguideSettings } from './use-styleguide-settings';
import { parseVimrc } from './vimrc-parser';

/**
 * Returns CodeMirror extensions for vim mode if enabled in settings.
 * Includes the critical allowMultipleSelections fix for block select (Ctrl+V).
 */
export function getVimExtensions() {
  const settings = getStyleguideSettings();
  if (!settings.vimMode) return [];
  return [
    vim({ status: settings.vimShowModeIndicator }),
    EditorState.allowMultipleSelections.of(true),
  ];
}

/**
 * Returns true if vim clipboard sync is enabled in settings.
 */
export function isVimClipboardSyncEnabled(): boolean {
  const settings = getStyleguideSettings();
  return settings.vimMode && settings.vimClipboardSync;
}

/**
 * Sync vim clipboard state based on current settings.
 * Sets up or tears down clipboard register overrides.
 * The setup function receives the editor element for focusin listener.
 */
export function syncVimClipboard(
  setup: (el: HTMLElement) => void,
  teardown: () => void,
  editorElement: HTMLElement,
): void {
  if (isVimClipboardSyncEnabled()) {
    setup(editorElement);
  } else {
    teardown();
  }
}

/**
 * Apply vimrc commands from settings to the given EditorView.
 * Parses the vimrc content and executes each command via Vim.handleEx().
 */
export function applyVimrc(view: EditorView): void {
  const settings = getStyleguideSettings();
  if (!settings.vimMode || !settings.vimrc) return;

  const cm = getCM(view) as Parameters<typeof Vim.handleEx>[0] | undefined;
  if (!cm) return;

  for (const cmd of parseVimrc(settings.vimrc)) {
    try {
      Vim.handleEx(cm, cmd);
    } catch (e) {
      console.warn(`vimrc command failed: ${cmd}`, e);
    }
  }
}
