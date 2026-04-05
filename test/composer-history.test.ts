import { describe, it, expect } from 'vitest';
import {
  historyReducer,
  createInitialHistoryState,
} from '../packages/pattern-gen-viewer/src/components/use-composer-history.js';
import type {
  ComposerDocumentState,
} from '../packages/pattern-gen-viewer/src/components/use-composer-history.js';

function makeState(label: string): ComposerDocumentState {
  return {
    layers: [{ id: label, type: 'text', name: label, content: label, fontFamily: 'Inter', fontSize: 48, fontWeight: 'normal', fontStyle: 'normal', color: '#fff', opacity: 1, textAlign: 'left', textVAlign: 'top', letterSpacing: 0, lineHeight: 1.4, shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: '#000' }, stroke: { enabled: false, color: '#000', width: 1 }, transform: { x: 0, y: 0, width: 100, height: 100 } }],
    frameConfig: null,
    gridConfig: { vDivide: 2, hDivide: 2, snap: false, visible: false, lineColor: 'rgba(180,180,180,0.5)' },
  };
}

describe('historyReducer', () => {
  const s0 = makeState('initial');

  it('creates initial state with empty past/future', () => {
    const state = createInitialHistoryState(s0);
    expect(state.present).toBe(s0);
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    expect(state.lastCommitted).toBe(s0);
  });

  it('SET updates present without affecting history', () => {
    const state = createInitialHistoryState(s0);
    const s1 = makeState('updated');
    const next = historyReducer(state, { type: 'SET', state: s1 });
    expect(next.present).toBe(s1);
    expect(next.past).toHaveLength(0);
    expect(next.future).toHaveLength(0);
  });

  it('COMMIT pushes lastCommitted to past and clears future', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    expect(state.past).toHaveLength(1);
    expect(state.past[0]).toBe(s0);
    expect(state.present).toBe(s1);
    expect(state.future).toHaveLength(0);
    expect(state.lastCommitted).toBe(s1);
  });

  it('COMMIT is a no-op when present === lastCommitted', () => {
    const state = createInitialHistoryState(s0);
    const next = historyReducer(state, { type: 'COMMIT' });
    expect(next).toBe(state); // same reference — no change
  });

  it('COMMIT clears future stack', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    const s2 = makeState('s2');
    // commit s0 -> s1
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    // commit s1 -> s2
    state = historyReducer(state, { type: 'SET', state: s2 });
    state = historyReducer(state, { type: 'COMMIT' });
    // undo to s1
    state = historyReducer(state, { type: 'UNDO' });
    expect(state.future).toHaveLength(1);
    // new commit from s1 should clear future
    const s3 = makeState('s3');
    state = historyReducer(state, { type: 'SET', state: s3 });
    state = historyReducer(state, { type: 'COMMIT' });
    expect(state.future).toHaveLength(0);
  });

  it('UNDO pops from past and pushes present to future', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'UNDO' });
    expect(state.present).toBe(s0);
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(1);
    expect(state.future[0]).toBe(s1);
  });

  it('UNDO is a no-op when past is empty', () => {
    const state = createInitialHistoryState(s0);
    const next = historyReducer(state, { type: 'UNDO' });
    expect(next).toBe(state);
  });

  it('REDO pops from future and pushes present to past', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'UNDO' });
    state = historyReducer(state, { type: 'REDO' });
    expect(state.present).toBe(s1);
    expect(state.past).toHaveLength(1);
    expect(state.past[0]).toBe(s0);
    expect(state.future).toHaveLength(0);
  });

  it('REDO is a no-op when future is empty', () => {
    const state = createInitialHistoryState(s0);
    const next = historyReducer(state, { type: 'REDO' });
    expect(next).toBe(state);
  });

  it('respects MAX_HISTORY (50) by shifting oldest entries', () => {
    let state = createInitialHistoryState(s0);
    for (let i = 0; i < 55; i++) {
      const s = makeState(`s${i}`);
      state = historyReducer(state, { type: 'SET', state: s });
      state = historyReducer(state, { type: 'COMMIT' });
    }
    expect(state.past.length).toBeLessThanOrEqual(50);
  });

  it('undo/redo round-trip preserves state identity', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    const s2 = makeState('s2');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'SET', state: s2 });
    state = historyReducer(state, { type: 'COMMIT' });
    // undo twice
    state = historyReducer(state, { type: 'UNDO' });
    state = historyReducer(state, { type: 'UNDO' });
    expect(state.present).toBe(s0);
    // redo twice
    state = historyReducer(state, { type: 'REDO' });
    expect(state.present).toBe(s1);
    state = historyReducer(state, { type: 'REDO' });
    expect(state.present).toBe(s2);
  });

  it('SET_LAYERS with array updates layers', () => {
    const state = createInitialHistoryState(s0);
    const newLayers = makeState('new').layers;
    const next = historyReducer(state, { type: 'SET_LAYERS', updater: newLayers });
    expect(next.present.layers).toBe(newLayers);
    expect(next.present.gridConfig).toBe(s0.gridConfig);
  });

  it('SET_LAYERS with function updater uses current layers', () => {
    const state = createInitialHistoryState(s0);
    const next = historyReducer(state, {
      type: 'SET_LAYERS',
      updater: (prev) => [...prev, ...makeState('extra').layers],
    });
    expect(next.present.layers).toHaveLength(2);
  });

  it('SET during drag does not create history entries', () => {
    let state = createInitialHistoryState(s0);
    // Simulate multiple mousemove SET calls (no commit)
    for (let i = 0; i < 10; i++) {
      state = historyReducer(state, { type: 'SET', state: makeState(`drag-${i}`) });
    }
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    // Only on mouseup commit
    state = historyReducer(state, { type: 'COMMIT' });
    expect(state.past).toHaveLength(1);
    expect(state.past[0]).toBe(s0); // original state before drag
  });

  // --- JUMP_TO ---

  it('JUMP_TO restores a past state and clears future', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    const s2 = makeState('s2');
    const s3 = makeState('s3');
    // Build history: s0 -> s1 -> s2 -> s3 (present)
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'SET', state: s2 });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'SET', state: s3 });
    state = historyReducer(state, { type: 'COMMIT' });
    // past = [s0, s1, s2], present = s3
    expect(state.past).toHaveLength(3);

    // Jump to index 1 (s1)
    state = historyReducer(state, { type: 'JUMP_TO', index: 1 });
    expect(state.present).toBe(s1);
    expect(state.future).toHaveLength(0); // future cleared
    expect(state.lastCommitted).toBe(s1);
    // past keeps entries before the jump index + appends old present
    expect(state.past).toHaveLength(2); // past[0]=s0 (before index 1) + s3 (old present)
    expect(state.past[0]).toBe(s0);
    expect(state.past[1]).toBe(s3);
  });

  it('JUMP_TO at index 0 goes to earliest history entry', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    const s2 = makeState('s2');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'SET', state: s2 });
    state = historyReducer(state, { type: 'COMMIT' });
    // past = [s0, s1], present = s2

    state = historyReducer(state, { type: 'JUMP_TO', index: 0 });
    expect(state.present).toBe(s0);
    expect(state.future).toHaveLength(0);
  });

  it('JUMP_TO with out-of-range index is a no-op', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    const before = state;
    state = historyReducer(state, { type: 'JUMP_TO', index: 99 });
    expect(state).toBe(before);
  });

  // --- PIN_SNAPSHOT ---

  it('PIN_SNAPSHOT adds a snapshot to the list', () => {
    let state = createInitialHistoryState(s0);
    expect(state.snapshots).toHaveLength(0);

    const snap = makeState('snap1');
    state = historyReducer(state, { type: 'PIN_SNAPSHOT', state: snap, label: 'My Snapshot' });
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0].label).toBe('My Snapshot');
    expect(state.snapshots[0].state).toBe(snap);
    expect(state.snapshots[0].id).toBeTruthy();
  });

  it('PIN_SNAPSHOT preserves existing snapshots', () => {
    let state = createInitialHistoryState(s0);
    const snap1 = makeState('snap1');
    const snap2 = makeState('snap2');
    state = historyReducer(state, { type: 'PIN_SNAPSHOT', state: snap1, label: 'First' });
    state = historyReducer(state, { type: 'PIN_SNAPSHOT', state: snap2, label: 'Second' });
    expect(state.snapshots).toHaveLength(2);
    expect(state.snapshots[0].label).toBe('First');
    expect(state.snapshots[1].label).toBe('Second');
  });

  // --- REMOVE_SNAPSHOT ---

  it('REMOVE_SNAPSHOT removes a snapshot by id', () => {
    let state = createInitialHistoryState(s0);
    const snap1 = makeState('snap1');
    const snap2 = makeState('snap2');
    state = historyReducer(state, { type: 'PIN_SNAPSHOT', state: snap1, label: 'First' });
    state = historyReducer(state, { type: 'PIN_SNAPSHOT', state: snap2, label: 'Second' });
    const idToRemove = state.snapshots[0].id;
    state = historyReducer(state, { type: 'REMOVE_SNAPSHOT', id: idToRemove });
    expect(state.snapshots).toHaveLength(1);
    expect(state.snapshots[0].label).toBe('Second');
  });

  it('REMOVE_SNAPSHOT with unknown id is a no-op', () => {
    let state = createInitialHistoryState(s0);
    const snap1 = makeState('snap1');
    state = historyReducer(state, { type: 'PIN_SNAPSHOT', state: snap1, label: 'First' });
    const before = state;
    state = historyReducer(state, { type: 'REMOVE_SNAPSHOT', id: 'nonexistent' });
    expect(state).toBe(before);
  });

  // --- RESTORE_SNAPSHOT ---

  it('RESTORE_SNAPSHOT commits current state and sets present to snapshot', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    // past = [s0], present = s1

    const snapState = makeState('snap-restore');
    state = historyReducer(state, { type: 'RESTORE_SNAPSHOT', state: snapState });
    expect(state.present).toBe(snapState);
    expect(state.lastCommitted).toBe(snapState);
    // s1 should be in past (committed before restore)
    expect(state.past).toHaveLength(2); // s0, s1
    expect(state.past[1]).toBe(s1);
    expect(state.future).toHaveLength(0);
  });

  it('RESTORE_SNAPSHOT from initial state commits and restores', () => {
    let state = createInitialHistoryState(s0);
    const snapState = makeState('snap-restore');
    state = historyReducer(state, { type: 'RESTORE_SNAPSHOT', state: snapState });
    // s0 was lastCommitted === present, so commit is a no-op, but restore still works
    expect(state.present).toBe(snapState);
  });

  // --- Labels ---

  it('initial state has empty label arrays and null pendingLabel', () => {
    const state = createInitialHistoryState(s0);
    expect(state.pastLabels).toEqual([]);
    expect(state.futureLabels).toEqual([]);
    expect(state.pendingLabel).toBeNull();
  });

  it('SET_PENDING_LABEL sets pendingLabel', () => {
    let state = createInitialHistoryState(s0);
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Add Text' });
    expect(state.pendingLabel).toBe('Add Text');
  });

  it('COMMIT uses pendingLabel and clears it', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Add Text' });
    state = historyReducer(state, { type: 'COMMIT' });
    expect(state.pastLabels).toEqual(['Add Text']);
    expect(state.pendingLabel).toBeNull();
  });

  it('COMMIT defaults label to Edit when no pendingLabel', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'COMMIT' });
    expect(state.pastLabels).toEqual(['Edit']);
  });

  it('COMMIT clears futureLabels', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Add Text' });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'UNDO' });
    expect(state.futureLabels).toEqual(['Add Text']);
    // New commit clears future labels
    const s2 = makeState('s2');
    state = historyReducer(state, { type: 'SET', state: s2 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'New Edit' });
    state = historyReducer(state, { type: 'COMMIT' });
    expect(state.futureLabels).toEqual([]);
  });

  it('UNDO moves label from pastLabels to futureLabels', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Add Image' });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'UNDO' });
    expect(state.pastLabels).toEqual([]);
    expect(state.futureLabels).toEqual(['Add Image']);
  });

  it('REDO moves label from futureLabels to pastLabels', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Move Layer' });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'UNDO' });
    state = historyReducer(state, { type: 'REDO' });
    expect(state.pastLabels).toEqual(['Move Layer']);
    expect(state.futureLabels).toEqual([]);
  });

  it('undo/redo round-trip preserves labels', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    const s2 = makeState('s2');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Add Text' });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'SET', state: s2 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Add Image' });
    state = historyReducer(state, { type: 'COMMIT' });
    // undo twice
    state = historyReducer(state, { type: 'UNDO' });
    state = historyReducer(state, { type: 'UNDO' });
    expect(state.pastLabels).toEqual([]);
    expect(state.futureLabels).toEqual(['Add Text', 'Add Image']);
    // redo twice
    state = historyReducer(state, { type: 'REDO' });
    state = historyReducer(state, { type: 'REDO' });
    expect(state.pastLabels).toEqual(['Add Text', 'Add Image']);
    expect(state.futureLabels).toEqual([]);
  });

  it('JUMP_TO reorders labels correctly', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    const s2 = makeState('s2');
    const s3 = makeState('s3');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Step 1' });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'SET', state: s2 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Step 2' });
    state = historyReducer(state, { type: 'COMMIT' });
    state = historyReducer(state, { type: 'SET', state: s3 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Step 3' });
    state = historyReducer(state, { type: 'COMMIT' });
    // past = [s0, s1, s2], pastLabels = ['Step 1', 'Step 2', 'Step 3']
    // Jump to index 1 (s1)
    state = historyReducer(state, { type: 'JUMP_TO', index: 1 });
    expect(state.pastLabels).toEqual(['Step 1', 'Current']);
    expect(state.futureLabels).toEqual([]);
  });

  it('pastLabels are trimmed when exceeding MAX_HISTORY', () => {
    let state = createInitialHistoryState(s0);
    for (let i = 0; i < 55; i++) {
      const s = makeState(`s${i}`);
      state = historyReducer(state, { type: 'SET', state: s });
      state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: `Step ${i}` });
      state = historyReducer(state, { type: 'COMMIT' });
    }
    expect(state.pastLabels.length).toBeLessThanOrEqual(50);
    expect(state.pastLabels.length).toBe(state.past.length);
  });

  // --- Crop confirm sequence ---

  it('SET + SET_PENDING_LABEL + COMMIT correctly stores crop in present', () => {
    let state = createInitialHistoryState(s0);
    const cropRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
    const stateWithCrop = { ...s0, crop: cropRect };
    state = historyReducer(state, { type: 'SET', state: stateWithCrop });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Set Crop' });
    state = historyReducer(state, { type: 'COMMIT' });
    expect(state.present.crop).toEqual(cropRect);
    expect(state.lastCommitted.crop).toEqual(cropRect);
    expect(state.past).toHaveLength(1);
    expect(state.past[0]).toBe(s0);
    expect(state.pastLabels).toEqual(['Set Crop']);
  });

  it('crop survives undo and redo round-trip', () => {
    let state = createInitialHistoryState(s0);
    const cropRect = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
    const stateWithCrop = { ...s0, crop: cropRect };
    state = historyReducer(state, { type: 'SET', state: stateWithCrop });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Set Crop' });
    state = historyReducer(state, { type: 'COMMIT' });
    // Undo should remove crop
    state = historyReducer(state, { type: 'UNDO' });
    expect(state.present.crop).toBeUndefined();
    // Redo should restore crop
    state = historyReducer(state, { type: 'REDO' });
    expect(state.present.crop).toEqual(cropRect);
  });

  it('RESTORE_SNAPSHOT sets labels for past entries', () => {
    let state = createInitialHistoryState(s0);
    const s1 = makeState('s1');
    state = historyReducer(state, { type: 'SET', state: s1 });
    state = historyReducer(state, { type: 'SET_PENDING_LABEL', label: 'Add Text' });
    state = historyReducer(state, { type: 'COMMIT' });
    const snapState = makeState('snap-restore');
    state = historyReducer(state, { type: 'RESTORE_SNAPSHOT', state: snapState });
    expect(state.pastLabels).toEqual(['Add Text', 'Before Restore']);
    expect(state.futureLabels).toEqual([]);
  });
});
