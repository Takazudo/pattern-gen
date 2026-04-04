import type { CSSProperties } from 'react';

export function getPopoverPosition(
  anchor: HTMLElement | null,
  estW: number,
  estH: number,
): CSSProperties {
  if (!anchor) return { position: 'fixed' as const, zIndex: 10100 };
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const pad = 8;
  const below = window.innerHeight - rect.bottom - pad;
  const above = rect.top - pad;
  const flipAbove = below < estH && above > below;
  let left = rect.left;
  if (left + estW > window.innerWidth - pad) left = window.innerWidth - pad - estW;
  if (left < pad) left = pad;
  const style: CSSProperties = {
    position: 'fixed' as const,
    left,
    zIndex: 10100,
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  };
  if (flipAbove) {
    style.bottom = window.innerHeight - rect.top + gap;
  } else {
    style.top = rect.bottom + gap;
  }
  return style;
}
