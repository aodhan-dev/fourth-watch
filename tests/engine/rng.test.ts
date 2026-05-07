import { describe, it, expect } from 'vitest';
import { makeRng, deriveSeed, pickIndex } from '../../src/lib/engine/rng';

describe('makeRng', () => {
  it('produces deterministic output for the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different output for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toEqual(b());
  });

  it('returns values in [0, 1)', () => {
    const r = makeRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('deriveSeed', () => {
  it('produces stable sub-seeds for the same parent + label', () => {
    expect(deriveSeed(100, 'weather')).toEqual(deriveSeed(100, 'weather'));
  });

  it('produces different sub-seeds for different labels', () => {
    expect(deriveSeed(100, 'weather')).not.toEqual(deriveSeed(100, 'encounter'));
  });

  it('produces different sub-seeds for different parents', () => {
    expect(deriveSeed(1, 'weather')).not.toEqual(deriveSeed(2, 'weather'));
  });
});

describe('pickIndex', () => {
  it('throws on a negative weight (caller bug, not a silent zero pick)', () => {
    expect(() => pickIndex(makeRng(1), [1, -1, 2])).toThrow(/non-negative/);
  });

  it('throws on a NaN weight', () => {
    expect(() => pickIndex(makeRng(1), [1, NaN])).toThrow(/non-negative finite/);
  });

  it('throws on an Infinity weight', () => {
    expect(() => pickIndex(makeRng(1), [1, Infinity])).toThrow(/non-negative finite/);
  });

  it('returns 0 on all-zero weights (engine boundary handles this case explicitly)', () => {
    expect(pickIndex(makeRng(1), [0, 0, 0])).toBe(0);
  });

  it('returns 0 on empty weights', () => {
    expect(pickIndex(makeRng(1), [])).toBe(0);
  });
});
