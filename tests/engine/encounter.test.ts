import { describe, it, expect } from 'vitest';
import {
  encounterCheck,
  encounterPick,
  crWindow,
  applyModifiers,
  type AppliedModifiers
} from '../../src/lib/engine/encounter';
import { makeRng } from '../../src/lib/engine/rng';
import type { Inputs, Monster, Weather } from '../../src/lib/engine/types';

const baseInputs = (overrides: Partial<Inputs> = {}): Inputs => ({
  climate: 'Temperate',
  environment: 'Forest',
  season: 'Spring',
  time: 'Day',
  region: 'Frontier',
  partyLevel: 3,
  partySize: 4,
  mode: 'Travelling',
  campfire: false,
  noise: false,
  mood: 'hostile',
  ...overrides
});

const tameWeather: Weather = {
  temp: 'Temperate',
  precip: 'Clear',
  wind: 'Low',
  narrative: '',
  effects: []
};
const wildWeather: Weather = {
  temp: 'Freezing',
  precip: 'Heavy',
  wind: 'High',
  narrative: '',
  effects: []
};

const sampleMonsters: Monster[] = [
  {
    slug: 'wolf',
    name: 'Wolf',
    cr: 0.25,
    type: 'beast',
    size: 'Medium',
    environments: ['Forest', 'Hills', 'Grassland'],
    hp: 11,
    ac: 13,
    speed: '40ft',
    category: 'Predator'
  },
  {
    slug: 'bandit',
    name: 'Bandit',
    cr: 0.125,
    type: 'humanoid',
    size: 'Medium',
    environments: ['Forest', 'Urban', 'Hills', 'Grassland'],
    hp: 11,
    ac: 12,
    speed: '30ft',
    category: 'Bandit'
  },
  {
    slug: 'guard',
    name: 'Guard',
    cr: 0.125,
    type: 'humanoid',
    size: 'Medium',
    environments: ['Urban'],
    hp: 11,
    ac: 16,
    speed: '30ft',
    category: 'Civilised'
  },
  {
    slug: 'zombie',
    name: 'Zombie',
    cr: 0.25,
    type: 'undead',
    size: 'Medium',
    environments: ['Swamp', 'Underground'],
    hp: 22,
    ac: 8,
    speed: '20ft',
    category: 'Undead'
  },
  {
    slug: 'troll',
    name: 'Troll',
    cr: 5,
    type: 'giant',
    size: 'Large',
    environments: ['Forest', 'Mountains', 'Swamp'],
    hp: 84,
    ac: 15,
    speed: '30ft',
    category: 'Predator'
  }
];

describe('crWindow', () => {
  it('returns wider window for higher region difficulty', () => {
    const settled = crWindow(3, 4, 'Settled');
    const hostile = crWindow(3, 4, 'Hostile');
    expect(hostile.max).toBeGreaterThan(settled.max);
  });

  it('floor scales with party level', () => {
    expect(crWindow(10, 4, 'Frontier').min).toBeGreaterThan(crWindow(1, 4, 'Frontier').min);
  });
});

describe('applyModifiers', () => {
  it('accepts an injected ModifiersFile (DI seam for tests and alt rule sets)', () => {
    const inputs = baseInputs();
    const stubRules = {
      schemaVersion: 1,
      baseEncounterChance: 0.5,
      rules: [
        {
          id: 'always-bandit',
          when: {},
          encounterChanceMultiplier: 2,
          categoryMultipliers: { Bandit: 10 } as const
        }
      ]
    };
    const out = applyModifiers(inputs, tameWeather, stubRules);
    expect(out.encounterChance).toBeCloseTo(1.0, 5); // 0.5 * 2 clamped
    expect(out.categoryWeights.Bandit).toBeCloseTo(10);
    expect(out.matchingRules.map((r) => r.id)).toEqual(['always-bandit']);
  });

  it('composes multiplicative encounter chance from matching rules', () => {
    const inputs = baseInputs({ region: 'Hostile', noise: true });
    const out = applyModifiers(inputs, tameWeather);
    expect(out.encounterChance).toBeCloseTo(0.72, 2);
  });

  it('multiplies category weights from matching rules', () => {
    const inputs = baseInputs({
      time: 'Night',
      region: 'Wilderness',
      mode: 'AtCamp',
      campfire: false
    });
    const out = applyModifiers(inputs, tameWeather);
    expect(out.categoryWeights.Predator).toBeGreaterThan(out.categoryWeights.Civilised);
  });

  it('treats heavy precip + high wind as severe weather', () => {
    const inputs = baseInputs();
    const out = applyModifiers(inputs, wildWeather);
    const calm = applyModifiers(inputs, tameWeather);
    expect(out.encounterChance).toBeLessThan(calm.encounterChance);
  });
});

describe('encounterCheck', () => {
  it('is deterministic', () => {
    const inputs = baseInputs();
    const a = encounterCheck(inputs, tameWeather, makeRng(99));
    const b = encounterCheck(inputs, tameWeather, makeRng(99));
    expect(a).toEqual(b);
  });

  it('triggers more often in hostile regions than settled', () => {
    let hostile = 0,
      settled = 0;
    for (let s = 0; s < 1000; s++) {
      if (encounterCheck(baseInputs({ region: 'Hostile' }), tameWeather, makeRng(s)).happens)
        hostile++;
      if (encounterCheck(baseInputs({ region: 'Settled' }), tameWeather, makeRng(s)).happens)
        settled++;
    }
    expect(hostile).toBeGreaterThan(settled * 2);
  });
});

describe('encounter attitude (SRD 5.2 Initial Attitude)', () => {
  it("mood='hostile' always sets attitude to Hostile", () => {
    const inputs = baseInputs({ mood: 'hostile' });
    for (let s = 0; s < 50; s++) {
      const r = encounterPick(inputs, tameWeather, sampleMonsters, makeRng(s));
      if (r.encounter) expect(r.encounter.attitude).toBe('Hostile');
    }
  });

  it("mood='mixed' produces a distribution across attitudes", () => {
    const inputs = baseInputs({ mood: 'mixed' });
    const seen = new Set<string>();
    for (let s = 0; s < 200; s++) {
      const r = encounterPick(inputs, tameWeather, sampleMonsters, makeRng(s));
      if (r.encounter) seen.add(r.encounter.attitude);
    }
    // Across 200 seeds with predator + bandit + civilised in the pool, we expect
    // at least two of the three attitudes to appear.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("mood='mixed' with civilised-only pool skews non-hostile (1d6+3 modifier)", () => {
    const civilOnly: Monster[] = [
      {
        slug: 'guard',
        name: 'Guard',
        cr: 0.125,
        type: 'humanoid',
        size: 'Medium',
        environments: ['Forest'],
        hp: 11,
        ac: 16,
        speed: '30ft',
        category: 'Civilised'
      }
    ];
    const inputs = baseInputs({ mood: 'mixed', region: 'Hostile', noise: true });
    let nonHostile = 0,
      hostile = 0;
    for (let s = 0; s < 300; s++) {
      const r = encounterPick(inputs, tameWeather, civilOnly, makeRng(s));
      if (!r.encounter) continue;
      if (r.encounter.attitude === 'Hostile') hostile++;
      else nonHostile++;
    }
    // 1d6+3 with this mapping: roll 1..6 + 3 = 4..9. Always >= 4, so never <= 2.
    // Therefore Civilised under mixed should never produce Hostile.
    expect(hostile).toBe(0);
    expect(nonHostile).toBeGreaterThan(0);
  });
});

describe('encounterPick – all-zero category weights', () => {
  it('returns null with message when all category weights are zero', () => {
    const categories = [
      'Predator',
      'Bandit',
      'Civilised',
      'Undead',
      'Fey',
      'Aberration',
      'Construct',
      'Other'
    ] as const;
    const allZeroMods: AppliedModifiers = {
      encounterChance: 0.5,
      categoryWeights: Object.fromEntries(
        categories.map((c) => [c, 0])
      ) as AppliedModifiers['categoryWeights'],
      matchingRules: []
    };
    const result = encounterPick(
      baseInputs(),
      tameWeather,
      sampleMonsters,
      makeRng(1),
      allZeroMods
    );
    expect(result.encounter).toBeNull();
    expect(result.message).toBeTruthy();
  });
});

describe('encounterPick', () => {
  it('returns null with hint when pool is empty even after widening', () => {
    const result = encounterPick(
      baseInputs({ environment: 'Wasteland' }),
      tameWeather,
      [],
      makeRng(1)
    );
    expect(result.encounter).toBeNull();
    expect(result.message).toBeTruthy();
  });

  it('respects environment filter', () => {
    for (let s = 0; s < 50; s++) {
      const r = encounterPick(
        baseInputs({ environment: 'Urban' }),
        tameWeather,
        sampleMonsters,
        makeRng(s)
      );
      if (r.encounter) {
        expect(r.encounter.creature.environments).toContain('Urban');
      }
    }
  });

  it('biases toward predators at night in wilderness', () => {
    let predators = 0,
      civilised = 0;
    const inputs = baseInputs({
      environment: 'Forest',
      region: 'Wilderness',
      time: 'Night',
      mode: 'AtCamp',
      campfire: false
    });
    for (let s = 0; s < 500; s++) {
      const r = encounterPick(inputs, tameWeather, sampleMonsters, makeRng(s));
      if (!r.encounter) continue;
      if (r.encounter.creature.category === 'Predator') predators++;
      if (r.encounter.creature.category === 'Civilised') civilised++;
    }
    expect(predators).toBeGreaterThan(civilised);
  });
});
