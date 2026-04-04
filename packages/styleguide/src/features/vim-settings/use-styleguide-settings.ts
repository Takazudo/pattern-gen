import { useState, useEffect, useCallback } from 'react';

export interface StyleguideSettings {
  vimMode: boolean;
  vimClipboardSync: boolean;
  vimShowModeIndicator: boolean;
  vimrc: string;
}

const STORAGE_KEY = 'styleguide-settings';
export const CHANGE_EVENT = 'styleguide-settings-changed';

const DEFAULTS: StyleguideSettings = {
  vimMode: false,
  vimClipboardSync: true,
  vimShowModeIndicator: true,
  vimrc: '',
};

function readFromStorage(): StyleguideSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeToStorage(settings: StyleguideSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Standalone reader for non-React code (e.g. CodeMirror setup).
 * Returns the current settings from localStorage.
 */
export function getStyleguideSettings(): StyleguideSettings {
  return readFromStorage();
}

/**
 * React hook for reading and updating styleguide settings.
 * Persists to localStorage and dispatches a custom event so
 * non-React listeners (e.g. CodeMirror) can react to changes.
 */
export function useStyleguideSettings(): [
  StyleguideSettings,
  (partial: Partial<StyleguideSettings>) => void,
] {
  const [settings, setSettings] = useState<StyleguideSettings>(DEFAULTS);

  // Sync from localStorage on mount
  useEffect(() => {
    setSettings(readFromStorage());
  }, []);

  // Listen for changes from other tabs or other hook instances
  useEffect(() => {
    function handleChange() {
      setSettings(readFromStorage());
    }
    function handleStorageChange(e: StorageEvent) {
      if (e.key === STORAGE_KEY) handleChange();
    }
    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const updateSettings = useCallback((partial: Partial<StyleguideSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      writeToStorage(next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
      return next;
    });
  }, []);

  return [settings, updateSettings];
}
