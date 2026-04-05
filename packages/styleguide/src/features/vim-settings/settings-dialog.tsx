import { useCallback, useEffect, useRef, useState } from 'react';
import type { StyleguideSettings } from './use-styleguide-settings';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: StyleguideSettings;
  onUpdateSettings: (partial: Partial<StyleguideSettings>) => void;
}

function CheckboxRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      <div className="flex items-center gap-x-hsp-md">
        <input
          type="checkbox"
          className="h-[1rem] w-[1rem] accent-accent shrink-0"
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
        <label htmlFor={id} className="text-small font-semibold text-fg select-none">
          {label}
        </label>
      </div>
      {hint && <p className="mt-vsp-3xs ml-[1.75rem] text-caption text-muted">{hint}</p>}
    </div>
  );
}

export default function SettingsDialog({
  open,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Local vimrc state — commit to settings only on blur/close to avoid
  // destroying/recreating all editors on every keystroke
  const [localVimrc, setLocalVimrc] = useState(settings.vimrc);
  const localVimrcRef = useRef(localVimrc);
  localVimrcRef.current = localVimrc;

  // Flush pending vimrc edits and close
  const handleClose = useCallback(() => {
    if (localVimrcRef.current !== settings.vimrc) {
      onUpdateSettings({ vimrc: localVimrcRef.current });
    }
    onClose();
  }, [onClose, onUpdateSettings, settings.vimrc]);

  // Show dialog on mount (component is only rendered when open=true)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Handle Escape key via native dialog cancel event
    function handleCancel(e: Event) {
      e.preventDefault();
      handleClose();
    }
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [handleClose]);

  // Close on backdrop click
  function handleBackdropClick(e: { clientX: number; clientY: number }) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      handleClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="settings-dialog-title"
      className="w-full max-w-[28rem] border border-muted bg-surface text-fg rounded-lg backdrop:bg-bg/80"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-muted px-hsp-xl py-vsp-sm">
        <h2 id="settings-dialog-title" className="text-subheading font-bold text-fg">
          Settings
        </h2>
        <button
          type="button"
          onClick={handleClose}
          className="flex items-center justify-center text-muted transition-colors hover:text-fg"
          aria-label="Close settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-hsp-xl py-vsp-md">
        {/* Vim Mode section */}
        <h3 className="text-small font-bold text-muted mb-vsp-sm">Vim Mode</h3>

        <div className="flex flex-col gap-y-vsp-sm">
          <CheckboxRow
            id="settings-vim-mode"
            label="Enable Vim Mode"
            checked={settings.vimMode}
            onChange={(checked) => onUpdateSettings({ vimMode: checked })}
          />

          <CheckboxRow
            id="settings-vim-clipboard"
            label="Clipboard Sync"
            hint="Sync vim yank/paste with system clipboard"
            checked={settings.vimClipboardSync}
            disabled={!settings.vimMode}
            onChange={(checked) => onUpdateSettings({ vimClipboardSync: checked })}
          />

          <CheckboxRow
            id="settings-vim-indicator"
            label="Mode Indicator"
            hint="Show NORMAL/INSERT/VISUAL status"
            checked={settings.vimShowModeIndicator}
            disabled={!settings.vimMode}
            onChange={(checked) => onUpdateSettings({ vimShowModeIndicator: checked })}
          />

          {/* Vimrc textarea */}
          <div className={!settings.vimMode ? 'opacity-40 pointer-events-none' : ''}>
            <label
              htmlFor="settings-vimrc"
              className="text-small font-semibold text-fg select-none"
            >
              Vimrc
            </label>
            <textarea
              id="settings-vimrc"
              aria-describedby="settings-vimrc-hint"
              className="mt-vsp-3xs w-full py-vsp-2xs px-hsp-sm border border-muted rounded-lg bg-surface text-fg text-caption font-mono outline-none focus:border-accent resize-y"
              rows={5}
              maxLength={4096}
              disabled={!settings.vimMode}
              spellcheck={false}
              autocomplete="off"
              value={localVimrc}
              onChange={(e) => setLocalVimrc(e.currentTarget.value)}
              placeholder={'nmap j gj\nnmap k gk\nimap jk <Esc>'}
            />
            <p id="settings-vimrc-hint" className="mt-vsp-3xs text-caption text-muted">
              Configure vim key mappings. Supports nmap, imap, set commands.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-muted px-hsp-xl py-vsp-sm flex justify-end">
        <button
          type="button"
          onClick={handleClose}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
