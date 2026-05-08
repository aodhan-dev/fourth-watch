import type { Inputs, Monster, RollResult } from './types';
import { makeRng, deriveSeed } from './rng';
import { rollWeather } from './weather';
import { applyModifiers, encounterCheck, encounterPick } from './encounter';

// Empty by default; callers should pass the catalog loaded via dynamic import.
const defaultMonsters: Monster[] = [];

export class EngineRangeError extends Error {
  constructor(field: string, value: number, range: string) {
    super(`${field} must be in range ${range}, got ${value}`);
    this.name = 'EngineRangeError';
  }
}

function checkInputs(inputs: Inputs): void {
  if (!Number.isInteger(inputs.partyLevel) || inputs.partyLevel < 1 || inputs.partyLevel > 20)
    throw new EngineRangeError('partyLevel', inputs.partyLevel, '[1, 20]');
  if (!Number.isInteger(inputs.partySize) || inputs.partySize < 1 || inputs.partySize > 8)
    throw new EngineRangeError('partySize', inputs.partySize, '[1, 8]');
}

export interface RerollOptions {
  // A fresh seed for the weather stream only. Goes through deriveSeed(value, 'weather')
  // so callers don't have to know the engine's internal namespacing.
  rerollWeather?: number;
  // A fresh seed for the encounter stream only. Same contract as rerollWeather.
  rerollEncounter?: number;
}

export function roll(
  inputs: Inputs,
  seed: number,
  opts: RerollOptions = {},
  monsters: Monster[] = defaultMonsters
): RollResult {
  checkInputs(inputs);
  // Both the default and override paths run through deriveSeed with the same
  // namespace, so a caller-supplied rerollWeather behaves identically to the
  // primary seed under the engine's substream contract.
  const weatherSeed = deriveSeed(opts.rerollWeather ?? seed, 'weather');
  const encounterSeed = deriveSeed(opts.rerollEncounter ?? seed, 'encounter');

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
export { parseMonsterCatalog } from './validate';
export * from './types';
