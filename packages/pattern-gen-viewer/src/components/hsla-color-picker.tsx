import { useState, useEffect, useCallback, useRef } from 'react';
import { hexToHsla, hslaToHex, hslaToString } from '../utils/color-hsla.js';
import './hsla-color-picker.css';

/* ── usePopoverClose ── */

function usePopoverClose(
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  isOpen: boolean,
) {
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, containerRef]);

  useEffect(() => {
    if (!isOpen) return;
    function handleScroll() {
      onClose();
    }
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen, onClose]);
}

/* ── getFixedPopoverStyle ── */

function getFixedPopoverStyle(
  anchor: HTMLElement | null,
  estW: number,
  estH: number,
): React.CSSProperties {
  if (!anchor) return { position: 'fixed', zIndex: 300 };
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const pad = 8;
  const below = window.innerHeight - rect.bottom - pad;
  const above = rect.top - pad;
  const flipAbove = below < estH && above > below;
  let left = rect.left;
  if (left + estW > window.innerWidth - pad) left = window.innerWidth - pad - estW;
  if (left < pad) left = pad;
  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    zIndex: 300,
  };
  if (flipAbove) {
    style.bottom = window.innerHeight - rect.top + gap;
  } else {
    style.top = rect.bottom + gap;
  }
  return style;
}

/* ── Slider config ── */

const SLIDERS = [
  { label: 'H', key: 'h' as const, max: 360, suffix: '' },
  { label: 'S', key: 's' as const, max: 100, suffix: '%' },
  { label: 'L', key: 'l' as const, max: 100, suffix: '%' },
  { label: 'A', key: 'a' as const, max: 100, suffix: '%' },
];

/* ── HslaColorPicker (popover) ── */

function HslaColorPicker({
  color,
  onChange,
  onClose,
  anchorRef,
}: {
  color: string;
  onChange: (hex: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hsla, setHsla] = useState(() => hexToHsla(color));
  const [hexInput, setHexInput] = useState(color);

  useEffect(() => {
    setHsla(hexToHsla(color));
    setHexInput(color);
  }, [color]);

  usePopoverClose(containerRef, onClose, true);

  function updateFromHsla(newHsla: { h: number; s: number; l: number; a: number }) {
    setHsla(newHsla);
    const hex = hslaToHex(newHsla.h, newHsla.s, newHsla.l, newHsla.a);
    setHexInput(hex);
    onChange(hex);
  }

  function handleHexChange(value: string) {
    setHexInput(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value) || /^#[0-9a-fA-F]{8}$/.test(value)) {
      const parsed = hexToHsla(value);
      setHsla(parsed);
      onChange(value);
    }
  }

  const cssColor = hslaToString(hsla.h, hsla.s, hsla.l, hsla.a);

  return (
    <div
      ref={containerRef}
      className="ogp-hsla-picker"
      style={getFixedPopoverStyle(anchorRef.current, 320, 220)}
    >
      <div className="ogp-hsla-top-row">
        <div className="ogp-hsla-preview">
          {hsla.a < 100 && <div className="ogp-hsla-preview-checkerboard" />}
          <div className="ogp-hsla-preview-color" style={{ backgroundColor: cssColor }} />
        </div>
        <input
          type="text"
          className="ogp-hsla-hex-input"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          spellCheck={false}
          aria-label="Hex color value"
        />
      </div>
      {SLIDERS.map(({ label, key, max, suffix }) => (
        <div key={key} className="ogp-hsla-slider-row">
          <span className="ogp-hsla-slider-label">{label}</span>
          <input
            type="range"
            min={0}
            max={max}
            value={hsla[key]}
            onChange={(e) =>
              updateFromHsla({ ...hsla, [key]: parseInt(e.target.value, 10) })
            }
            aria-label={
              label === 'H'
                ? 'Hue'
                : label === 'S'
                  ? 'Saturation'
                  : label === 'L'
                    ? 'Lightness'
                    : 'Alpha'
            }
          />
          <span className="ogp-hsla-slider-value">
            {hsla[key]}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── HslaColorSwatch (trigger button + popover) ── */

export function HslaColorSwatch({
  color,
  onChange,
  label,
}: {
  color: string;
  onChange: (hex: string) => void;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const hsla = hexToHsla(color);
  const showCheckerboard = hsla.a < 100;
  const cssColor = hslaToString(hsla.h, hsla.s, hsla.l, hsla.a);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="ogp-hsla-swatch-btn"
        style={{ width: 28, height: 28 }}
        onClick={() => setIsOpen((prev) => !prev)}
        title={label ? `${label}: ${color}` : color}
      >
        {showCheckerboard && <div className="ogp-hsla-swatch-checkerboard" />}
        <div className="ogp-hsla-swatch-color" style={{ backgroundColor: cssColor }} />
      </button>
      {isOpen && (
        <HslaColorPicker
          color={color}
          onChange={onChange}
          onClose={handleClose}
          anchorRef={buttonRef}
        />
      )}
    </>
  );
}
