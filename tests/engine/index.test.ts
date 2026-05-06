import { describe, it, expect } from 'vitest';
import { roll } from '../../src/lib/engine';
import type { Inputs } from '../../src/lib/engine/types';

const inputs: Inputs = {
  climate: 'Temperate',
  environment: 'Forest',
  season: 'Spring',
  time: 'Day',
  region: 'Frontier',
  partyLevel: 3,
  partySize: 4,
  mode: 'Travelling',
  campfire: false,
  noise: false
};

describe('roll', () => {
  it('produces deterministic full result for same seed', () => {
    const a = roll(inputs, 12345);
    const b = roll(inputs, 12345);
    expect(a).toEqual(b);
  });

  it('returns the seed in the result', () => {
    expect(roll(inputs, 999).seed).toBe(999);
  });

  it('weather-only and encounter-only sub-seeds are independent', () => {
    const a = roll(inputs, 100);
    const b = roll(inputs, 100, { rerollWeather: 200 });
    expect(b.encounter).toEqual(a.encounter);
    expect(b.weather).not.toEqual(a.weather);
  });

  it('encounter-only re-roll keeps weather identical', () => {
    const a = roll(inputs, 100);
    const b = roll(inputs, 100, { rerollEncounter: 300 });
    expect(b.weather).toEqual(a.weather);
  });
});
