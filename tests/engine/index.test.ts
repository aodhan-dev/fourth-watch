import { describe, it, expect } from 'vitest';
import { roll, EngineRangeError } from '../../src/lib/engine';
import type { Inputs, Monster } from '../../src/lib/engine/types';

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

const fixtureMonsters: Monster[] = [
  {
    slug: 'fixture-wolf',
    name: 'Fixture Wolf',
    cr: 0.25,
    type: 'beast',
    size: 'Medium',
    environments: ['Forest'],
    hp: 11,
    ac: 13,
    speed: '40ft',
    category: 'Predator'
  }
];

describe('roll', () => {
  it('produces deterministic full result for same seed', () => {
    const a = roll(inputs, 12345);
    const b = roll(inputs, 12345);
    expect(a).toEqual(b);
  });

  it('returns the seed in the result', () => {
    expect(roll(inputs, 999).seed).toBe(999);
  });

  it('weather-only re-roll changes the weather', () => {
    // Note: this does not assert encounter equality. Weather severity feeds the
    // modifier rule scan, so a different weather can legitimately change the
    // encounter pick even with the same primary seed. The encounter-only
    // direction is covered by the next test.
    const a = roll(inputs, 100);
    const b = roll(inputs, 100, { rerollWeather: 200 });
    expect(b.weather).not.toEqual(a.weather);
  });

  it('encounter-only re-roll keeps weather identical', () => {
    const a = roll(inputs, 100);
    const b = roll(inputs, 100, { rerollEncounter: 300 });
    expect(b.weather).toEqual(a.weather);
  });

  it('throws EngineRangeError on out-of-range partyLevel', () => {
    expect(() => roll({ ...inputs, partyLevel: 0 }, 1)).toThrow(EngineRangeError);
    expect(() => roll({ ...inputs, partyLevel: 21 }, 1)).toThrow(EngineRangeError);
    expect(() => roll({ ...inputs, partyLevel: 3.5 }, 1)).toThrow(EngineRangeError);
  });

  it('throws EngineRangeError on out-of-range partySize', () => {
    expect(() => roll({ ...inputs, partySize: 0 }, 1)).toThrow(EngineRangeError);
    expect(() => roll({ ...inputs, partySize: 9 }, 1)).toThrow(EngineRangeError);
  });

  it('uses an injected monster catalog when one is provided', () => {
    // Force an encounter-likely scenario, then verify the chosen creature comes
    // from the injected fixture catalog rather than the bundled SRD snapshot.
    const hot = { ...inputs, region: 'Hostile' as const, noise: true };
    let rolled = 0;
    let seenFixture = false;
    for (let s = 0; s < 50 && !seenFixture; s++) {
      const r = roll(hot, s, {}, fixtureMonsters);
      if (r.encounter) {
        rolled++;
        if (r.encounter.creature.slug === 'fixture-wolf') seenFixture = true;
      }
    }
    expect(rolled).toBeGreaterThan(0);
    expect(seenFixture).toBe(true);
  });
});
