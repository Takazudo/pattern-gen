import { Vim } from '@replit/codemirror-vim';

let clipboardActive = false;
let originalStarRegister: unknown = null;
let originalPlusRegister: unknown = null;
let originalUnnamedRegister: unknown = null;
let clipboardSyncCleanup: (() => void) | null = null;

type ClipboardRegister = ReturnType<typeof createClipboardRegister>;

function createClipboardRegister() {
  const register = {
    keyBuffer: [] as string[],
    insertModeChanges: [] as never[],
    searchQueries: [] as string[],
    linewise: false,
    blockwise: false,

    setText(text?: string, linewise?: boolean, blockwise?: boolean) {
      register.keyBuffer = text ? [text] : [];
      register.linewise = !!linewise;
      register.blockwise = !!blockwise;
      if (text) {
        navigator.clipboard.writeText(text).catch(console.warn);
      }
    },

    pushText(text: string, linewise?: boolean) {
      register.keyBuffer.push(text);
      register.linewise = !!linewise;
      const fullText = register.keyBuffer.join('\n');
      navigator.clipboard.writeText(fullText).catch(console.warn);
    },

    pushInsertModeChanges(_changes: never) {
      // Not applicable for clipboard register
    },

    pushSearchQuery(_query: string) {
      // Not applicable for clipboard register
    },

    clear() {
      register.keyBuffer = [];
      register.linewise = false;
      register.blockwise = false;
    },

    toString() {
      return register.keyBuffer.join('\n');
    },
  };

  return register;
}

let isSyncing = false;

/**
 * Read system clipboard and update the register's keyBuffer so that
 * vim paste (`p`/`P`) uses the latest external clipboard content.
 * Guards against concurrent calls and checks cancellation after the
 * async read to avoid mutating the register after teardown.
 */
async function syncFromSystemClipboard(register: ClipboardRegister, isCancelled: () => boolean) {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const text = await navigator.clipboard.readText();
    if (isCancelled()) return;
    if (text && register.keyBuffer.join('\n') !== text) {
      register.keyBuffer = [text];
      register.linewise = text.endsWith('\n');
      register.blockwise = false;
    }
  } catch {
    // clipboard permission denied — ignore
  } finally {
    isSyncing = false;
  }
}

/**
 * Replace the vim unnamed register (`"`) in both the registers map and the
 * controller's direct `unnamedRegister` reference. Both must be updated
 * because @replit/codemirror-vim caches the unnamed register as an own
 * property on the controller and uses it in pushText/getRegister internally.
 *
 * Note: `unnamedRegister` is an internal library property accessed via cast.
 * If the library renames it, clipboard sync will silently degrade to only
 * `*`/`+` register behaviour (still partially functional, not broken).
 */
function applyUnnamedRegister(
  controller: Record<string, unknown>,
  registers: Record<string, unknown>,
  reg: unknown,
): void {
  registers['"'] = reg;
  controller.unnamedRegister = reg;
}

export function setupVimClipboard(editorElement: HTMLElement): void {
  if (clipboardActive) return;

  const controller = Vim.getRegisterController() as Record<string, unknown>;
  const registers = controller.registers as Record<string, unknown>;

  // Save originals so we can restore them later
  originalStarRegister = registers['*'];
  originalPlusRegister = registers['+'];
  originalUnnamedRegister = registers['"'];

  const clipboardRegister = createClipboardRegister();
  registers['*'] = clipboardRegister;
  registers['+'] = clipboardRegister;

  // Also replace the unnamed register (") so that default yank/paste
  // (without a "+/" prefix) uses the system clipboard. This is equivalent
  // to vim's `set clipboard=unnamedplus`.
  applyUnnamedRegister(controller, registers, clipboardRegister);

  // Cancellation flag: prevents in-flight async reads from mutating
  // the register after teardown
  let cancelled = false;

  // Sync system clipboard → register on focus so that content
  // copied in other apps is available for vim paste
  const syncHandler = () => {
    if (!cancelled) {
      syncFromSystemClipboard(clipboardRegister, () => cancelled);
    }
  };

  window.addEventListener('focus', syncHandler);
  editorElement.addEventListener('focusin', syncHandler);

  clipboardSyncCleanup = () => {
    cancelled = true;
    window.removeEventListener('focus', syncHandler);
    editorElement.removeEventListener('focusin', syncHandler);
  };

  clipboardActive = true;
}

export function teardownVimClipboard(): void {
  if (!clipboardActive) return;

  clipboardSyncCleanup?.();
  clipboardSyncCleanup = null;
  isSyncing = false;

  const controller = Vim.getRegisterController() as Record<string, unknown>;
  const registers = controller.registers as Record<string, unknown>;

  if (originalStarRegister !== null) {
    registers['*'] = originalStarRegister;
  }
  if (originalPlusRegister !== null) {
    registers['+'] = originalPlusRegister;
  }
  if (originalUnnamedRegister !== null) {
    applyUnnamedRegister(controller, registers, originalUnnamedRegister);
  }

  originalStarRegister = null;
  originalPlusRegister = null;
  originalUnnamedRegister = null;
  clipboardActive = false;
}
