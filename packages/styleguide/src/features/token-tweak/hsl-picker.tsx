import { useState, useEffect, useRef, useCallback } from 'react';
import { hexToHsl, hslToHex } from './color-convert';

interface HslPickerProps {
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export default function HslPicker({ color, onChange, onClose, anchorEl }: HslPickerProps) {
  const [hsl, setHsl] = useState(() => hexToHsl(color));
  const [hexInput, setHexInput] = useState(color);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    flipAbove: boolean;
  }>({ top: 0, left: 0, flipAbove: false });

  // Position the popover relative to anchor
  useEffect(() => {
    const anchor = anchorEl;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popoverHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;
    setPosition({
      top: flipAbove ? rect.top - popoverHeight - 4 : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 240),
      flipAbove,
    });
  }, [anchorEl]);

  // Sync when color prop changes externally
  useEffect(() => {
    const newHsl = hexToHsl(color);
    setHsl(newHsl);
    setHexInput(color);
  }, [color]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const updateFromHsl = useCallback(
    (h: number, s: number, l: number) => {
      setHsl({ h, s, l });
      const hex = hslToHex(h, s, l);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange],
  );

  const handleHexInput = (value: string) => {
    setHexInput(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      const newHsl = hexToHsl(value);
      setHsl(newHsl);
      onChange(value);
    }
  };

  const sliderRow = (
    label: string,
    value: number,
    max: number,
    onInput: (v: number) => void,
    bgGradient: string,
  ) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
      }}
    >
      <span
        style={{
          width: 14,
          fontSize: 10,
          fontWeight: 600,
          color: '#999',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
        style={{
          flex: 1,
          height: 6,
          cursor: 'pointer',
          accentColor: hslToHex(hsl.h, hsl.s, hsl.l),
          background: bgGradient,
          borderRadius: 3,
        }}
      />
      <span
        style={{
          width: 28,
          fontSize: 10,
          color: '#999',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {value}
        {label === 'H' ? '' : '%'}
      </span>
    </div>
  );

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10001,
        width: 230,
        background: '#1e1e2e',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: 12,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Swatch + hex input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: 6,
            background: hexInput,
            border: '1px solid rgba(255,255,255,0.12)',
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexInput((e.target as HTMLInputElement).value)}
          style={{
            flex: 1,
            background: '#313244',
            color: '#cdd6f4',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'ui-monospace, monospace',
          }}
        />
      </div>

      {sliderRow(
        'H',
        hsl.h,
        360,
        (v) => updateFromHsl(v, hsl.s, hsl.l),
        'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))',
      )}

      {sliderRow(
        'S',
        hsl.s,
        100,
        (v) => updateFromHsl(hsl.h, v, hsl.l),
        `linear-gradient(to right, hsl(${hsl.h},0%,${hsl.l}%), hsl(${hsl.h},100%,${hsl.l}%))`,
      )}

      {sliderRow(
        'L',
        hsl.l,
        100,
        (v) => updateFromHsl(hsl.h, hsl.s, v),
        `linear-gradient(to right, hsl(${hsl.h},${hsl.s}%,0%), hsl(${hsl.h},${hsl.s}%,50%), hsl(${hsl.h},${hsl.s}%,100%))`,
      )}
    </div>
  );
}
