import { CompositionMenu } from './composition-menu';

export const meta = { title: 'UI/CompositionMenu' };

export const Default = () => (
  <div style={{ position: 'relative', height: 200 }}>
    <CompositionMenu
      compositionTitle="My Pattern"
      onNew={() => console.log('New')}
      onOpen={() => console.log('Open')}
      onSave={() => console.log('Save')}
      onSaveAs={() => console.log('Save As')}
      onDuplicate={() => console.log('Duplicate')}
    />
  </div>
);
