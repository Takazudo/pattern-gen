import { describe, it, expect } from 'vitest';
import { getFrameParam, getFrameParamClamped } from '../packages/generators/src/frames/get-frame-param.js';

describe('getFrameParam', () => {
  it('returns default when key is missing', () => {
    expect(getFrameParam({}, 'foo', 10)).toBe(10);
    expect(getFrameParam({}, 'bar', 'hello')).toBe('hello');
  });

  it('returns default when value is null', () => {
    expect(getFrameParam({ foo: null }, 'foo', 5)).toBe(5);
  });

  it('returns default when value is undefined', () => {
    expect(getFrameParam({ foo: undefined }, 'foo', 5)).toBe(5);
  });

  it('returns the value when key exists with correct type', () => {
    expect(getFrameParam({ x: 42 }, 'x', 10)).toBe(42);
    expect(getFrameParam({ c: '#ff0000' }, 'c', '#000000')).toBe('#ff0000');
  });

  it('returns default on type mismatch (string where number expected)', () => {
    expect(getFrameParam({ x: 'not-a-number' }, 'x', 10)).toBe(10);
  });

  it('returns default on type mismatch (number where string expected)', () => {
    expect(getFrameParam({ c: 123 }, 'c', '#000000')).toBe('#000000');
  });

  it('handles zero as a valid number', () => {
    expect(getFrameParam({ x: 0 }, 'x', 10)).toBe(0);
  });

  it('returns default when value is NaN', () => {
    expect(getFrameParam({ x: NaN }, 'x', 10)).toBe(10);
  });

  it('handles empty string as a valid string', () => {
    expect(getFrameParam({ c: '' }, 'c', '#000000')).toBe('');
  });
});

describe('getFrameParamClamped', () => {
  it('returns default when key is missing', () => {
    expect(getFrameParamClamped({}, 'x', 10, 0, 100)).toBe(10);
  });

  it('returns the value when within range', () => {
    expect(getFrameParamClamped({ x: 50 }, 'x', 10, 0, 100)).toBe(50);
  });

  it('clamps to min when value is below', () => {
    expect(getFrameParamClamped({ x: -5 }, 'x', 10, 0, 100)).toBe(0);
  });

  it('clamps to max when value is above', () => {
    expect(getFrameParamClamped({ x: 200 }, 'x', 10, 0, 100)).toBe(100);
  });

  it('clamps default when default itself is out of range', () => {
    expect(getFrameParamClamped({}, 'x', 150, 0, 100)).toBe(100);
  });
});
