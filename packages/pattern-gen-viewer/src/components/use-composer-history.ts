import { useReducer, useCallback } from 'react';
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

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  return {
    state: history.present,
    set,
    setLayers,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
