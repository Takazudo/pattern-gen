import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useMswWorker } from './msw-context';

interface MswVariantHandlersProps {
  handlers: any[];
  children: ReactNode;
}

/**
 * Applies per-variant MSW handlers when mounted and resets them on unmount.
 * Must be rendered inside MswProvider.
 */
export function MswVariantHandlers({ handlers, children }: MswVariantHandlersProps) {
  const worker = useMswWorker();

  useEffect(() => {
    if (!worker || handlers.length === 0) return;
    worker.use(...handlers);
    return () => {
      worker.resetHandlers();
    };
  }, [worker, handlers]);

  return <>{children}</>;
}
