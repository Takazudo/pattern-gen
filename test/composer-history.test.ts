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
});
