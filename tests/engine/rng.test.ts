import { describe, it, expect } from 'vitest';
import { makeRng, deriveSeed } from '../../src/lib/engine/rng';

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
