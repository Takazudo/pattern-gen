import { SaveCompositionModal } from './save-composition-modal';

export const meta = { title: 'Dialog/SaveCompositionModal' };

export const Default = () => (
  <SaveCompositionModal
    patternType="voronoi"
    configJson='{"patternType":"voronoi","seed":"demo"}'
    onClose={() => console.log('Close')}
    onSaved={(composition) => console.log('Saved:', composition)}
  />
);

export const WithPreview = () => (
  <SaveCompositionModal
    patternType="hexagonal"
    configJson='{"patternType":"hexagonal","seed":"preview-demo"}'
    previewDataUrl="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23334' width='200' height='200'/%3E%3Ccircle cx='100' cy='100' r='60' fill='%23556'/%3E%3C/svg%3E"
    onClose={() => console.log('Close')}
    onSaved={(composition) => console.log('Saved:', composition)}
  />
);
