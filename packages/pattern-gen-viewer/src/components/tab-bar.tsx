import { useState, useRef, useEffect, useCallback } from 'react';
import './tab-bar.css';

export interface Tab {
  id: string;
  name: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onAdd: () => void;
  onRename: (tabId: string, newName: string) => void;
}

export function TabBar({ tabs, activeTabId, onSwitch, onClose, onAdd, onRename }: TabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitRename = useCallback(() => {
    if (editingId) {
      const trimmed = editValue.trim();
      if (trimmed) {
        onRename(editingId, trimmed);
      }
      setEditingId(null);
    }
  }, [editingId, editValue, onRename]);

  const handleDoubleClick = useCallback((tab: Tab) => {
    setEditingId(tab.id);
    setEditValue(tab.name);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitRename();
      } else if (e.key === 'Escape') {
        setEditingId(null);
      }
    },
    [commitRename],
  );

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-bar-tab${tab.id === activeTabId ? ' active' : ''}`}
          onClick={() => onSwitch(tab.id)}
          onDoubleClick={() => handleDoubleClick(tab)}
        >
          {editingId === tab.id ? (
            <input
              ref={inputRef}
              className="tab-bar-tab-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tab-bar-tab-name">{tab.name}</span>
          )}
          {tabs.length > 1 && (
            <span
              className="tab-bar-close"
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
            >
              ×
            </span>
          )}
        </button>
      ))}
      <button className="tab-bar-add" onClick={onAdd} title="New tab">
        +
      </button>
    </div>
  );
}
