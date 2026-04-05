import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { EditorLayer, FrameConfig, CropRect } from '@takazudo/pattern-gen-core';
import type { GridConfig } from './composer.js';

export interface ComposerDocumentState {
  layers: (EditorLayer & { id: string })[];
  frameConfig: FrameConfig | null;
  gridConfig: GridConfig;
  crop?: CropRect;
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
  /** Labels describing each past state (what action produced it) */
  pastLabels: string[];
  /** Labels describing each future state (what action produced it) */
  futureLabels: string[];
  pendingLabel: string | null;
  /** Label describing the current present state */
  presentLabel: string;
}

type LayerWithId = EditorLayer & { id: string };
type LayerUpdater = LayerWithId[] | ((prev: LayerWithId[]) => LayerWithId[]);

export type HistoryAction =
  | { type: 'SET'; state: ComposerDocumentState }
  | { type: 'SET_LAYERS'; updater: LayerUpdater }
  | { type: 'SET_PENDING_LABEL'; label: string }
  | { type: 'COMMIT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'REDO_TO'; index: number }
  | { type: 'RESET' }
  | { type: 'JUMP_TO'; index: number }
  | { type: 'PIN_SNAPSHOT'; state: ComposerDocumentState; label: string }
  | { type: 'REMOVE_SNAPSHOT'; id: string }
  | { type: 'RESTORE_SNAPSHOT'; state: ComposerDocumentState };

const MAX_HISTORY = 50;
const MAX_SNAPSHOTS = 20;

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

    case 'SET_PENDING_LABEL':
      return { ...current, pendingLabel: action.label };

    case 'COMMIT': {
      // Skip if nothing changed since last commit
      if (current.present === current.lastCommitted) return current;
      const label = current.pendingLabel || 'Edit';
      const newPast = [...current.past, current.lastCommitted];
      const newPastLabels = [...current.pastLabels, current.presentLabel];
      if (newPast.length > MAX_HISTORY) {
        newPast.shift();
        newPastLabels.shift();
      }
      return {
        ...current,
        past: newPast,
        pastLabels: newPastLabels,
        present: current.present,
        future: [],
        futureLabels: [],
        lastCommitted: current.present,
        pendingLabel: null,
        presentLabel: label,
      };
    }

    case 'UNDO': {
      if (current.past.length === 0) return current;
      const newPast = [...current.past];
      const previous = newPast.pop()!;
      const newPastLabels = [...current.pastLabels];
      const poppedLabel = newPastLabels.pop()!;
      return {
        ...current,
        past: newPast,
        pastLabels: newPastLabels,
        present: previous,
        future: [current.present, ...current.future],
        futureLabels: [current.presentLabel, ...current.futureLabels],
        lastCommitted: previous,
        presentLabel: poppedLabel,
      };
    }

    case 'REDO': {
      if (current.future.length === 0) return current;
      const newFuture = [...current.future];
      const next = newFuture.shift()!;
      const [redoLabel, ...restFutureLabels] = current.futureLabels;
      return {
        ...current,
        past: [...current.past, current.present],
        pastLabels: [...current.pastLabels, current.presentLabel],
        present: next,
        future: newFuture,
        futureLabels: restFutureLabels,
        lastCommitted: next,
        presentLabel: redoLabel || 'Edit',
      };
    }

    case 'REDO_TO': {
      const { index } = action;
      if (index < 0 || index >= current.future.length) return current;
      const target = current.future[index];
      const redone = current.future.slice(0, index + 1);
      const remaining = current.future.slice(index + 1);
      const redoneLabels = current.futureLabels.slice(0, index + 1);
      const remainingLabels = current.futureLabels.slice(index + 1);
      const newPast = [...current.past, current.present, ...redone.slice(0, -1)];
      const newPastLabels = [...current.pastLabels, current.presentLabel, ...redoneLabels.slice(0, -1)];
      return {
        ...current,
        past: newPast,
        pastLabels: newPastLabels,
        present: target,
        future: remaining,
        futureLabels: remainingLabels,
        lastCommitted: target,
        presentLabel: redoneLabels[index] || 'Edit',
      };
    }

    case 'JUMP_TO': {
      const { index } = action;
      if (index < 0 || index >= current.past.length) return current;
      const target = current.past[index];
      // Keep past entries before the jump point
      const newPast = current.past.slice(0, index);
      const newPastLabels = current.pastLabels.slice(0, index);
      // Entries after the jump point + current present become future (Photoshop-like)
      const afterJump = current.past.slice(index + 1);
      const afterJumpLabels = current.pastLabels.slice(index + 1);
      const newFuture = [...afterJump, current.present, ...current.future];
      const newFutureLabels = [...afterJumpLabels, current.presentLabel, ...current.futureLabels];
      return {
        ...current,
        past: newPast,
        pastLabels: newPastLabels,
        present: target,
        future: newFuture,
        futureLabels: newFutureLabels,
        lastCommitted: target,
        presentLabel: current.pastLabels[index] || 'Edit',
      };
    }

    case 'PIN_SNAPSHOT': {
      const snapshot: HistorySnapshot = {
        id: crypto.randomUUID(),
        label: action.label,
        state: action.state,
      };
      const newSnapshots = [...current.snapshots, snapshot];
      if (newSnapshots.length > MAX_SNAPSHOTS) newSnapshots.shift();
      return {
        ...current,
        snapshots: newSnapshots,
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
      // If there are uncommitted changes (present !== lastCommitted), push
      // lastCommitted to past first, then push current present. This preserves
      // both the last committed state and any uncommitted work so the user
      // can jump back to either via undo/history.
      const newPast = current.present !== current.lastCommitted
        ? [...current.past, current.lastCommitted]
        : [...current.past];
      const newPastLabels = current.present !== current.lastCommitted
        ? [...current.pastLabels, 'Uncommitted']
        : [...current.pastLabels];
      if (newPast.length > MAX_HISTORY) {
        newPast.shift();
        newPastLabels.shift();
      }
      const finalPast = [...newPast, current.present];
      const finalPastLabels = [...newPastLabels, current.presentLabel];
      if (finalPast.length > MAX_HISTORY) {
        finalPast.shift();
        finalPastLabels.shift();
      }
      return {
        ...current,
        past: finalPast,
        pastLabels: finalPastLabels,
        present: action.state,
        future: [],
        futureLabels: [],
        lastCommitted: action.state,
        presentLabel: 'Restore Snapshot',
      };
    }

    case 'RESET':
      return {
        ...current,
        past: [],
        pastLabels: [],
        future: [],
        futureLabels: [],
        lastCommitted: current.present,
        pendingLabel: null,
      };
  }
}

export function createInitialHistoryState(initial: ComposerDocumentState): HistoryState {
  return {
    past: [],
    present: initial,
    future: [],
    lastCommitted: initial,
    snapshots: [],
    pastLabels: [],
    futureLabels: [],
    pendingLabel: null,
    presentLabel: 'Initial',
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
  /** Redo to a specific future entry by index (atomic, single dispatch) */
  redoTo: (index: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Past states for history panel display */
  historyEntries: ComposerDocumentState[];
  /** Labels for past history entries */
  historyLabels: string[];
  /** Future (undone) states for display */
  futureEntries: ComposerDocumentState[];
  /** Labels for future entries */
  futureLabels: string[];
  /** Set a label for the next commit */
  setLabel: (label: string) => void;
  /** Label describing the current present state */
  presentLabel: string;
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
  /** Reset history — clears past/future, makes current state the new baseline */
  reset: () => void;
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

  const redoTo = useCallback((index: number) => {
    flushContinuous();
    dispatch({ type: 'REDO_TO', index });
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

  const setLabel = useCallback((label: string) => {
    dispatch({ type: 'SET_PENDING_LABEL', label });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state: history.present,
    set,
    setLayers,
    commit,
    commitContinuous,
    flushContinuous,
    undo,
    redo,
    redoTo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyEntries: history.past,
    historyLabels: history.pastLabels,
    futureEntries: history.future,
    futureLabels: history.futureLabels,
    setLabel,
    presentLabel: history.presentLabel,
    snapshots: history.snapshots,
    jumpTo,
    pinSnapshot,
    removeSnapshot,
    restoreSnapshot,
    reset,
  };
}
