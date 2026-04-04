import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'styleguide-code-panel-visible';
const CHANGE_EVENT = 'styleguide-code-panel-changed';

function readVisibility(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

function writeVisibility(visible: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(visible));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * React hook for reading and toggling the code panel visibility.
 * Persists to localStorage and dispatches a custom event so
 * other components can react to changes.
 */
export function useCodePanel(): [boolean, () => void] {
  const [visible, setVisible] = useState(readVisibility);

  useEffect(() => {
    function handleChange() {
      setVisible(readVisibility());
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

  const toggle = useCallback(() => {
    const next = !readVisibility();
    writeVisibility(next);
    setVisible(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }, []);

  return [visible, toggle];
}
