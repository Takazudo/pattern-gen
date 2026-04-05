import type { MouseEvent } from 'react';

interface DiscardConfirmationDialogProps {
  onDiscard: () => void;
  onKeep: () => void;
  onCancel: () => void;
}

export function DiscardConfirmationDialog({
  onDiscard,
  onKeep,
  onCancel,
}: DiscardConfirmationDialogProps) {
  return (
    <div className="url-modal-overlay" onClick={onCancel}>
      <div className="discard-dialog" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <div className="url-modal-title">Unsaved Changes</div>
        <p className="url-modal-description">
          You have unsaved changes. What would you like to do?
        </p>
        <div className="discard-dialog-actions">
          <button className="btn discard-dialog-discard" onClick={onDiscard}>
            Discard
          </button>
          <button className="btn discard-dialog-keep" onClick={onKeep}>
            Keep
          </button>
          <button className="btn discard-dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
