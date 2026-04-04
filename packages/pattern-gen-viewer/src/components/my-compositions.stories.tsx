import { MyCompositions } from './my-compositions';
import type { Composition } from '../lib/api-types.js';

export const meta = { title: 'Data/MyCompositions' };

export const Empty = () => (
  <MyCompositions
    onClose={() => console.log('Close')}
    onLoadComposition={(composition: Composition) =>
      console.log('Load composition:', composition.name)
    }
  />
);

export const Default = () => (
  <MyCompositions
    onClose={() => console.log('Close')}
    onLoadComposition={(composition: Composition) =>
      console.log('Load composition:', composition.name)
    }
  />
);
