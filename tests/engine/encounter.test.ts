import { describe, it, expect } from 'vitest';
import {
  encounterCheck,
  encounterPick,
  crWindow,
  applyModifiers
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
    statblock: '',
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
    statblock: '',
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
    statblock: '',
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
    statblock: '',
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
    statblock: '',
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
