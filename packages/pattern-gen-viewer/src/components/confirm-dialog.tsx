import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  message?: string;
  children?: ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="url-modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-title">{title}</div>
        {message && <p className="confirm-dialog-message">{message}</p>}
        {children && <div className="confirm-dialog-content">{children}</div>}
        <div className="confirm-dialog-actions">
          <button className="btn confirm-dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${confirmVariant === 'danger' ? 'confirm-dialog-danger' : 'confirm-dialog-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
