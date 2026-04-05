import { useState, useEffect, useRef } from 'react';
import './edit-menu.css';

interface EditMenuProps {
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSlice: () => void;
  onCrop: () => void;
}

export function EditMenu({
  canUndo,
  canRedo,
  hasSelection,
  hasClipboard,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onSlice,
  onCrop,
}: EditMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div className="edit-menu-trigger" ref={rootRef}>
      <button
        className="edit-menu-trigger-btn"
        onClick={() => setOpen(!open)}
      >
        Edit
      </button>
      {open && (
        <div className="edit-menu-dropdown">
          <button
            className="edit-menu-item"
            disabled={!canUndo}
            onClick={() => handleAction(onUndo)}
          >
            <span>Undo</span>
            <span className="edit-menu-item-shortcut">{'\u2318'}Z</span>
          </button>
          <button
            className="edit-menu-item"
            disabled={!canRedo}
            onClick={() => handleAction(onRedo)}
          >
            <span>Redo</span>
            <span className="edit-menu-item-shortcut">{'\u2318\u21E7'}Z</span>
          </button>
          <div className="edit-menu-separator" />
          <button
            className="edit-menu-item"
            disabled={!hasSelection}
            onClick={() => handleAction(onCut)}
          >
            <span>Cut</span>
            <span className="edit-menu-item-shortcut">{'\u2318'}X</span>
          </button>
          <button
            className="edit-menu-item"
            disabled={!hasSelection}
            onClick={() => handleAction(onCopy)}
          >
            <span>Copy</span>
            <span className="edit-menu-item-shortcut">{'\u2318'}C</span>
          </button>
          <button
            className="edit-menu-item"
            disabled={!hasClipboard}
            onClick={() => handleAction(onPaste)}
          >
            <span>Paste</span>
            <span className="edit-menu-item-shortcut">{'\u2318'}V</span>
          </button>
          <div className="edit-menu-separator" />
          <button
            className="edit-menu-item"
            onClick={() => handleAction(onSlice)}
          >
            <span>Slice</span>
          </button>
          <button
            className="edit-menu-item"
            onClick={() => handleAction(onCrop)}
          >
            <span>Crop</span>
          </button>
        </div>
      )}
    </div>
  );
}
