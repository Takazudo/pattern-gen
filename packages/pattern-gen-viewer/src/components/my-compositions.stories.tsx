import { MyCompositions } from './my-compositions';

export const meta = { title: 'UI/MyCompositions' };

export const Empty = () => (
  <MyCompositions
    onClose={() => console.log('Close')}
    onLoadComposition={(configJson, patternType) =>
      console.log('Load composition:', patternType, configJson)
    }
  />
);

export const Default = () => (
  <MyCompositions
    onClose={() => console.log('Close')}
    onLoadComposition={(configJson, patternType) =>
      console.log('Load composition:', patternType, configJson)
    }
  />
);
