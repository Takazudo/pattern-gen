import { DiscardConfirmationDialog } from './discard-confirmation-dialog';

export const meta = { title: 'Dialog/DiscardConfirmationDialog' };

export const Default = () => (
  <DiscardConfirmationDialog
    onDiscard={() => console.log('Discard')}
    onKeep={() => console.log('Keep')}
    onCancel={() => console.log('Cancel')}
  />
);
