import { describe, it, expect, afterEach } from 'vitest';
import { validateFormState } from '../src/lib/storage';
import { newSeed, setRngSource, resetRngSource } from '../src/lib/seed';

const VALID_PAYLOAD = {
  climate: 'Temperate',
  environment: 'Forest',
  season: 'Summer',
  time: 'Day',
  region: 'Frontier',
  partyLevel: 5,
  partySize: 4,
  mode: 'Travelling',
  campfire: false,
  noise: false
};

describe('validateFormState', () => {
  it('accepts a valid payload', () => {
    const result = validateFormState(VALID_PAYLOAD);
    expect(result).not.toBeNull();
    expect(result?.climate).toBe('Temperate');
    expect(result?.partyLevel).toBe(5);
  });

  it('accepts empty string enum fields (unset dropdowns)', () => {
    const result = validateFormState({ ...VALID_PAYLOAD, climate: '', environment: '' });
    expect(result).not.toBeNull();
  });

  it('accepts AtCamp mode with campfire true', () => {
    const result = validateFormState({ ...VALID_PAYLOAD, mode: 'AtCamp', campfire: true });
    expect(result).not.toBeNull();
    expect(result?.campfire).toBe(true);
  });

  it('rejects a tampered climate value', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, climate: 'Oceanic' })).toBeNull();
  });

  it('rejects a tampered environment value', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, environment: 'Marsh' })).toBeNull();
  });

  it('rejects a tampered season value', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, season: 'Monsoon' })).toBeNull();
  });

  it('rejects a tampered mode value', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, mode: 'Flying' })).toBeNull();
  });

  it('rejects partyLevel out of range', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, partyLevel: 0 })).toBeNull();
    expect(validateFormState({ ...VALID_PAYLOAD, partyLevel: 21 })).toBeNull();
  });

  it('rejects partyLevel as a non-integer', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, partyLevel: 3.5 })).toBeNull();
  });

  it('rejects partySize out of range', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, partySize: 0 })).toBeNull();
    expect(validateFormState({ ...VALID_PAYLOAD, partySize: 9 })).toBeNull();
  });

  it('rejects campfire as non-boolean', () => {
    expect(validateFormState({ ...VALID_PAYLOAD, campfire: 1 })).toBeNull();
  });

  it('rejects a non-object payload', () => {
    expect(validateFormState('corrupted')).toBeNull();
    expect(validateFormState(null)).toBeNull();
    expect(validateFormState(42)).toBeNull();
    expect(validateFormState([])).toBeNull();
  });

  it('rejects payload missing a required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { mode: _mode, ...rest } = VALID_PAYLOAD;
    expect(validateFormState(rest)).toBeNull();
  });
});

describe('newSeed (injectable)', () => {
  afterEach(() => {
    resetRngSource();
  });

  it('returns a 32-bit unsigned integer', () => {
    const s = newSeed();
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(s)).toBe(true);
  });

  it('is injectable with a deterministic counter source', () => {
    let counter = 0;
    setRngSource(() => (counter++ % 10) / 10);
    const s1 = newSeed(); // source returns 0/10 = 0
    const s2 = newSeed(); // source returns 1/10 = 0.1
    expect(s1).toBe(0);
    expect(s2).toBe(Math.floor(0.1 * 0xffffffff) >>> 0);
  });

  it('reverts to non-deterministic after resetRngSource', () => {
    setRngSource(() => 0.5);
    expect(newSeed()).toBe(Math.floor(0.5 * 0xffffffff) >>> 0);
    resetRngSource();
    // After reset, values should vary (not always the fixed 0.5 result)
    const results = new Set(Array.from({ length: 20 }, () => newSeed()));
    expect(results.size).toBeGreaterThan(1);
  });
});
