import { useRef, useEffect } from 'react';
import type { ComposerDocumentState, HistorySnapshot } from './use-composer-history.js';
import './composer-history-panel.css';

/* ── SVG Icons ── */

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5L13.5 6.5L10 10L11.5 14.5L8 11L4.5 14.5L6 10L2.5 6.5L6.5 2.5L9.5 2.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M5 4.5V13a1 1 0 001 1h4a1 1 0 001-1V4.5" />
    </svg>
  );
}

/* ── Props ── */

interface ComposerHistoryPanelProps {
  historyEntries: ComposerDocumentState[];
  snapshots: HistorySnapshot[];
  onJumpTo: (index: number) => void;
  onPinSnapshot: (state: ComposerDocumentState, label: string) => void;
  onRemoveSnapshot: (id: string) => void;
  onRestoreSnapshot: (state: ComposerDocumentState) => void;
}

const MAX_VISIBLE_ENTRIES = 30;

/* ── Component ── */

export function ComposerHistoryPanel({
  historyEntries,
  snapshots,
  onJumpTo,
  onPinSnapshot,
  onRemoveSnapshot,
  onRestoreSnapshot,
}: ComposerHistoryPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when entries change (most recent at bottom)
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [historyEntries.length]);

  // Show only the last MAX_VISIBLE_ENTRIES
  const startIndex = Math.max(0, historyEntries.length - MAX_VISIBLE_ENTRIES);
  const visibleEntries = historyEntries.slice(startIndex);

  return (
    <div className="composer-history-panel">
      {/* Snapshots section */}
      <h4 className="composer-history-section-header">Snapshots</h4>
      <div className="composer-history-snapshots">
        {snapshots.length === 0 ? (
          <div className="composer-history-snapshot-empty">
            Pin a history state to save it
          </div>
        ) : (
          snapshots.map((snap) => (
            <div
              key={snap.id}
              className="composer-history-snapshot-item"
              onClick={() => onRestoreSnapshot(snap.state)}
              title={`Restore: ${snap.label}`}
            >
              <span className="composer-history-snapshot-icon">
                <PinIcon />
              </span>
              <span className="composer-history-snapshot-label">{snap.label}</span>
              <button
                className="composer-history-snapshot-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSnapshot(snap.id);
                }}
                title="Remove snapshot"
              >
                <TrashIcon />
              </button>
            </div>
          ))
        )}
      </div>

      {/* History entries */}
      <h4 className="composer-history-section-header">History</h4>
      <div className="composer-history-list" ref={listRef}>
        {visibleEntries.length === 0 ? (
          <div className="composer-history-empty">No history yet</div>
        ) : (
          visibleEntries.map((entry, i) => {
            const actualIndex = startIndex + i;
            return (
              <div
                key={actualIndex}
                className="composer-history-entry"
                onClick={() => onJumpTo(actualIndex)}
                title={`Restore State ${actualIndex + 1}`}
              >
                <span className="composer-history-entry-label">
                  State {actualIndex + 1}
                </span>
                <button
                  className="composer-history-entry-pin"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinSnapshot(entry, `State ${actualIndex + 1}`);
                  }}
                  title="Pin as snapshot"
                >
                  <PinIcon />
                </button>
              </div>
            );
          })
        )}
        {/* Current state marker */}
        <div className="composer-history-current">
          <span className="composer-history-current-dot" />
          <span>Current</span>
        </div>
      </div>
    </div>
  );
}
