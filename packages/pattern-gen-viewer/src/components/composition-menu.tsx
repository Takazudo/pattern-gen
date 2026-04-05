import { useState, useRef, useEffect, useCallback } from 'react';

interface CompositionMenuProps {
  compositionTitle: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onDuplicate: () => void;
}

export function CompositionMenu({
  compositionTitle,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onDuplicate,
}: CompositionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="composition-menu-wrapper" ref={menuRef}>
      <button
        className="floating-link composition-menu-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="composition-menu-trigger-title">{compositionTitle}</span>
        <span className="composition-menu-chevron" aria-hidden="true">&#9662;</span>
      </button>
      {open && (
        <div className="composition-menu-dropdown">
          <button className="composition-menu-item" onClick={() => handleAction(onNew)}>
            New
          </button>
          <button className="composition-menu-item" onClick={() => handleAction(onOpen)}>
            Open...
          </button>
          <div className="composition-menu-divider" />
          <button className="composition-menu-item" onClick={() => handleAction(onSave)}>
            Save
          </button>
          <button className="composition-menu-item" onClick={() => handleAction(onSaveAs)}>
            Save As...
          </button>
          <button className="composition-menu-item" onClick={() => handleAction(onDuplicate)}>
            Duplicate
          </button>
        </div>
      )}
    </div>
  );
}
