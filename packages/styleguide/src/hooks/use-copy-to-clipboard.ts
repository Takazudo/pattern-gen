import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook for copy-to-clipboard with brief "Copied!" feedback.
 * Returns [copied, handleCopy] where copied resets after 1.5s.
 * Cleans up timer on unmount and prevents stacking on rapid clicks.
 */
export function useCopyToClipboard(getText: () => string): [boolean, () => void] {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(getText()).then(
      () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setCopied(true);
        timerRef.current = setTimeout(() => setCopied(false), 1500);
      },
      () => {
        // clipboard write denied — silently ignore
      },
    );
  }, [getText]);

  return [copied, handleCopy];
}
