import type { Inputs, Monster, RollResult } from './types';
import { makeRng, deriveSeed } from './rng';
import { rollWeather } from './weather';
import { applyModifiers, encounterCheck, encounterPick } from './encounter';
import monstersData from '../data/monsters.json';
import { parseMonsterCatalog } from './validate';

const defaultMonsters = parseMonsterCatalog(monstersData);

export interface RerollOptions {
  rerollWeather?: number;
  rerollEncounter?: number;
}

export function roll(
  inputs: Inputs,
  seed: number,
  opts: RerollOptions = {},
  monsters: Monster[] = defaultMonsters
): RollResult {
  const weatherSeed = opts.rerollWeather ?? deriveSeed(seed, 'weather');
  const encounterSeed = opts.rerollEncounter ?? deriveSeed(seed, 'encounter');

  const weather = rollWeather(inputs, makeRng(weatherSeed));
  const checkRng = makeRng(deriveSeed(encounterSeed, 'check'));
  const pickRng = makeRng(deriveSeed(encounterSeed, 'pick'));

  // Compute modifiers once per roll: encounterCheck and encounterPick share the result
  // instead of recomputing the rule scan twice.
  const mods = applyModifiers(inputs, weather);

  const check = encounterCheck(inputs, weather, checkRng, mods);
  if (!check.happens) {
    return { seed, weather, encounter: null, encounterMessage: 'The road is quiet.' };
  }

  const pick = encounterPick(inputs, weather, monsters, pickRng, mods);
  return {
    seed,
    weather,
    encounter: pick.encounter,
    encounterMessage: pick.encounter ? null : pick.message
  };
}

export { rollWeather, encounterCheck, encounterPick };
export * from './types';
