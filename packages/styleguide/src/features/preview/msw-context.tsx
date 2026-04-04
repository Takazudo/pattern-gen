import { createContext } from 'react';
import { useContext } from 'react';
import type { SetupWorker } from 'msw/browser';

export const MswContext = createContext<SetupWorker | null>(null);

export function useMswWorker(): SetupWorker | null {
  return useContext(MswContext);
}
