import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { EditorLayer, FrameConfig } from '@takazudo/pattern-gen-core';
import type { GridConfig } from './composer.js';

export interface ComposerDocumentState {
  layers: (EditorLayer & { id: string })[];
  frameConfig: FrameConfig | null;
  gridConfig: GridConfig;
}

interface HistoryState {
  past: ComposerDocumentState[];
  present: ComposerDocumentState;
  future: ComposerDocumentState[];
  /** Snapshot of present at last commit (used to detect no-op commits) */
  lastCommitted: ComposerDocumentState;
}

type LayerWithId = EditorLayer & { id: string };
type LayerUpdater = LayerWithId[] | ((prev: LayerWithId[]) => LayerWithId[]);

export type HistoryAction =
  | { type: 'SET'; state: ComposerDocumentState }
  | { type: 'SET_LAYERS'; updater: LayerUpdater }
  | { type: 'COMMIT' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

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
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
        lastCommitted: next,
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
  };
}

interface ComposerHistory {
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
    }, 500);
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
  };
}
