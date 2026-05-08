import type { Inputs, RollResult } from '$lib/engine/types';

export function makeDigest(result: RollResult): string {
  return [
    result.weather.temp,
    result.weather.precip,
    result.weather.wind,
    result.encounter ? result.encounter.creature.name : 'no-encounter'
  ].join(':');
}

export function logRoll(
  seed: number,
  inputs: Inputs,
  result: RollResult,
  logger: (tag: string, payload: unknown) => void = console.info
): void {
  logger('[fw] roll', {
    seed,
    climate: inputs.climate,
    environment: inputs.environment,
    season: inputs.season,
    time: inputs.time,
    region: inputs.region,
    partyLevel: inputs.partyLevel,
    partySize: inputs.partySize,
    mode: inputs.mode,
    campfire: inputs.campfire,
    noise: inputs.noise,
    digest: makeDigest(result)
  });
}
