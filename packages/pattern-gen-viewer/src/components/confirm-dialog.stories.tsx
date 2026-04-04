import { ConfirmDialog } from './confirm-dialog';

export const meta = { title: 'Dialog/ConfirmDialog' };

export const Default = () => (
  <ConfirmDialog
    title="Confirm Action"
    message="Are you sure you want to proceed?"
    onConfirm={() => console.log('Confirmed')}
    onCancel={() => console.log('Cancelled')}
  />
);

export const Danger = () => (
  <ConfirmDialog
    title="Delete Item"
    message="This action cannot be undone. Are you sure?"
    confirmLabel="Delete"
    confirmVariant="danger"
    onConfirm={() => console.log('Deleted')}
    onCancel={() => console.log('Cancelled')}
  />
);

export const WithImage = () => (
  <ConfirmDialog
    title="Delete Asset"
    confirmLabel="Delete"
    confirmVariant="danger"
    onConfirm={() => console.log('Deleted')}
    onCancel={() => console.log('Cancelled')}
  >
    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      <div
        style={{
          width: 120,
          height: 120,
          background: 'var(--color-control-bg)',
          borderRadius: 'var(--radius-md)',
          margin: '0 auto 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-fg-muted)',
          fontSize: 12,
        }}
      >
        asset-preview.png
      </div>
      <p style={{ color: 'var(--color-fg-muted)', fontSize: 13, margin: 0 }}>
        Are you sure you want to delete this asset?
      </p>
    </div>
  </ConfirmDialog>
);
