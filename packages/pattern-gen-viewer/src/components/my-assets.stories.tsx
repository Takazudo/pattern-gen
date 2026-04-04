import { MyAssets } from './my-assets';

export const meta = { title: 'Data/MyAssets' };

export const Empty = () => (
  <MyAssets
    onClose={() => console.log('Close')}
    onUseAsLayer={(file) => console.log('Use as layer:', file.name)}
  />
);

export const WithMockData = () => {
  // The mock API client returns empty by default.
  // The component will show "No uploaded assets yet."
  // In a real setup, setMockResponse could prefill data.
  return (
    <MyAssets
      onClose={() => console.log('Close')}
      onUseAsLayer={(file) => console.log('Use as layer:', file.name)}
    />
  );
};
