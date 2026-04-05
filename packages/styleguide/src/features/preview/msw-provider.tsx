import { useEffect, useState } from 'react';
import type { SetupWorker } from 'msw/browser';
import type { ReactNode } from 'react';
import { MswContext } from './msw-context';

/**
 * Initializes MSW browser worker for API mocking.
 * Provides the worker via MswContext so children can apply per-variant handlers.
 */
export function MswProvider({ children }: { children: ReactNode }) {
  const [worker, setWorker] = useState<SetupWorker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let workerRef: SetupWorker | null = null;

    (async () => {
      try {
        const mod = await import('../../mocks/browser');
        workerRef = mod.worker;
        await workerRef.start({
          onUnhandledRequest: 'bypass',
          serviceWorker: {
            url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
          },
          quiet: true,
        });
      } catch {
        // MSW not available — proceed anyway
        workerRef = null;
      }
      if (!cancelled) {
        setWorker(workerRef);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      workerRef?.stop();
    };
  }, []);

  if (!ready) {
    return <div className="p-hsp-md text-muted">Initializing API mocks...</div>;
  }

  return <MswContext.Provider value={worker}>{children}</MswContext.Provider>;
}
