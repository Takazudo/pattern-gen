import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { EditorLayer, FrameConfig } from '@takazudo/pattern-gen-core';
import type { GridConfig } from './composer.js';

export interface ComposerDocumentState {
  layers: (EditorLayer & { id: string })[];
  frameConfig: FrameConfig | null;
  gridConfig: GridConfig;
}

export interface HistorySnapshot {
  id: string;
  label: string;
  state: ComposerDocumentState;
}

interface HistoryState {
  past: ComposerDocumentState[];
  present: ComposerDocumentState;
  future: ComposerDocumentState[];
  /** Snapshot of present at last commit (used to detect no-op commits) */
  lastCommitted: ComposerDocumentState;
  snapshots: HistorySnapshot[];
}

type LayerWithId = EditorLayer & { id: string };
type LayerUpdater = LayerWithId[] | ((prev: LayerWithId[]) => LayerWithId[]);

export type HistoryAction =
  | { type: 'SET'; state: ComposerDocumentState }
  | { type: 'SET_LAYERS'; updater: LayerUpdater }
  | { type: 'COMMIT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'JUMP_TO'; index: number }
  | { type: 'PIN_SNAPSHOT'; state: ComposerDocumentState; label: string }
  | { type: 'REMOVE_SNAPSHOT'; id: string }
  | { type: 'RESTORE_SNAPSHOT'; state: ComposerDocumentState };

const MAX_HISTORY = 50;

export function historyReducer(
  current: HistoryState,
  action: HistoryAction,
): HistoryState {
  switch (action.type) {
    case 'SET':
      return { ...current, present: action.state };

    case 'SET_LAYERS': {
      const newLayers = typeof action.updater === 'function'
        ? action.updater(current.present.layers)
        : action.updater;
      return { ...current, present: { ...current.present, layers: newLayers } };
    }

    case 'COMMIT': {
      // Skip if nothing changed since last commit
      if (current.present === current.lastCommitted) return current;
      const newPast = [...current.past, current.lastCommitted];
      if (newPast.length > MAX_HISTORY) newPast.shift();
      return {
        ...current,
        past: newPast,
        present: current.present,
        future: [],
        lastCommitted: current.present,
      };
    }

    case 'UNDO': {
      if (current.past.length === 0) return current;
      const newPast = [...current.past];
      const previous = newPast.pop()!;
      return {
        ...current,
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
        lastCommitted: previous,
      };
    }

    case 'REDO': {
      if (current.future.length === 0) return current;
      const newFuture = [...current.future];
      const next = newFuture.shift()!;
      return {
        ...current,
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
        lastCommitted: next,
      };
    }

    case 'JUMP_TO': {
      const { index } = action;
      if (index < 0 || index >= current.past.length) return current;
      const target = current.past[index];
      // Commit current state first (add to past), then restore target
      const newPast = [...current.past, current.present];
      return {
        ...current,
        past: newPast,
        present: target,
        future: [],
        lastCommitted: target,
      };
    }

    case 'PIN_SNAPSHOT': {
      const snapshot: HistorySnapshot = {
        id: crypto.randomUUID(),
        label: action.label,
        state: action.state,
      };
      return {
        ...current,
        snapshots: [...current.snapshots, snapshot],
      };
    }

    case 'REMOVE_SNAPSHOT': {
      const filtered = current.snapshots.filter((s) => s.id !== action.id);
      if (filtered.length === current.snapshots.length) return current;
      return {
        ...current,
        snapshots: filtered,
      };
    }

    case 'RESTORE_SNAPSHOT': {
      // Commit current state, then set present to the snapshot's state
      const newPast = current.present !== current.lastCommitted
        ? [...current.past, current.lastCommitted]
        : [...current.past];
      if (newPast.length > MAX_HISTORY) newPast.shift();
      // Add the current present to past as well
      const finalPast = [...newPast, current.present];
      if (finalPast.length > MAX_HISTORY) finalPast.shift();
      return {
        ...current,
        past: finalPast,
        present: action.state,
        future: [],
        lastCommitted: action.state,
      };
    }
  }
}

export function createInitialHistoryState(initial: ComposerDocumentState): HistoryState {
  return {
    past: [],
    present: initial,
    future: [],
    lastCommitted: initial,
    snapshots: [],
  };
}

export interface ComposerHistory {
  state: ComposerDocumentState;
  set: (newState: ComposerDocumentState) => void;
  setLayers: (updater: LayerUpdater) => void;
  commit: () => void;
  /** Mark that a continuous interaction (e.g. slider drag) is in progress. No snapshot yet. */
  commitContinuous: () => void;
  /** End continuous interaction and create one history snapshot. */
  flushContinuous: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Past states for history panel display */
  historyEntries: ComposerDocumentState[];
  /** Pinned snapshots */
  snapshots: HistorySnapshot[];
  /** Jump to a specific entry in the past array */
  jumpTo: (index: number) => void;
  /** Pin a state as a named snapshot */
  pinSnapshot: (state: ComposerDocumentState, label: string) => void;
  /** Remove a snapshot by id */
  removeSnapshot: (id: string) => void;
  /** Restore a snapshot state (commits current, then sets present) */
  restoreSnapshot: (state: ComposerDocumentState) => void;
}

export function useComposerHistory(initial: ComposerDocumentState): ComposerHistory {
  const [history, dispatch] = useReducer(
    historyReducer,
    initial,
    createInitialHistoryState,
  );

  const set = useCallback((newState: ComposerDocumentState) => {
    dispatch({ type: 'SET', state: newState });
  }, []);

  const setLayers = useCallback((updater: LayerUpdater) => {
    dispatch({ type: 'SET_LAYERS', updater });
  }, []);

  const commit = useCallback(() => {
    dispatch({ type: 'COMMIT' });
  }, []);

  // --- Continuous interaction support ---
  const continuousRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const flushContinuous = useCallback(() => {
    if (continuousRef.current) {
      clearSafetyTimer();
      continuousRef.current = false;
      dispatch({ type: 'COMMIT' });
    }
  }, [clearSafetyTimer]);

  const commitContinuous = useCallback(() => {
    continuousRef.current = true;
    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => {
      safetyTimerRef.current = null;
      if (continuousRef.current) {
        continuousRef.current = false;
        dispatch({ type: 'COMMIT' });
      }
    }, 2000);
  }, [clearSafetyTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearSafetyTimer();
  }, [clearSafetyTimer]);

  const undo = useCallback(() => {
    flushContinuous();
    dispatch({ type: 'UNDO' });
  }, [flushContinuous]);

  const redo = useCallback(() => {
    flushContinuous();
    dispatch({ type: 'REDO' });
  }, [flushContinuous]);

  const jumpTo = useCallback((index: number) => {
    flushContinuous();
    dispatch({ type: 'JUMP_TO', index });
  }, [flushContinuous]);

  const pinSnapshot = useCallback((state: ComposerDocumentState, label: string) => {
    dispatch({ type: 'PIN_SNAPSHOT', state, label });
  }, []);

  const removeSnapshot = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_SNAPSHOT', id });
  }, []);

  const restoreSnapshot = useCallback((state: ComposerDocumentState) => {
    flushContinuous();
    dispatch({ type: 'RESTORE_SNAPSHOT', state });
  }, [flushContinuous]);

  return {
    state: history.present,
    set,
    setLayers,
    commit,
    commitContinuous,
    flushContinuous,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyEntries: history.past,
    snapshots: history.snapshots,
    jumpTo,
    pinSnapshot,
    removeSnapshot,
    restoreSnapshot,
  };
}
