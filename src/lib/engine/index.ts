import type { Inputs, RollResult, Monster } from './types';
import { makeRng, deriveSeed } from './rng';
import { rollWeather } from './weather';
import { encounterCheck, encounterPick } from './encounter';
import monstersData from '../data/monsters.json';

export interface RerollOptions {
  rerollWeather?: number;
  rerollEncounter?: number;
}

export function roll(inputs: Inputs, seed: number, opts: RerollOptions = {}): RollResult {
  const weatherSeed = opts.rerollWeather ?? deriveSeed(seed, 'weather');
  const encounterSeed = opts.rerollEncounter ?? deriveSeed(seed, 'encounter');

  const weather = rollWeather(inputs, makeRng(weatherSeed));
  const checkRng = makeRng(deriveSeed(encounterSeed, 'check'));
  const pickRng = makeRng(deriveSeed(encounterSeed, 'pick'));

  const check = encounterCheck(inputs, weather, checkRng);
  if (!check.happens) {
    return { seed, weather, encounter: null, encounterMessage: 'The road is quiet.' };
  }

  const pick = encounterPick(inputs, weather, monstersData as unknown as Monster[], pickRng);
  return {
    seed,
    weather,
    encounter: pick.encounter,
    encounterMessage: pick.encounter ? null : pick.message
  };
}

export { rollWeather, encounterCheck, encounterPick };
export * from './types';
