import type { Inputs, Weather, WeatherEffect, Temperature, Precipitation, Wind } from './types';
import type { Rng } from './rng';
import { pickFrom } from './rng';
import climateData from '../data/climate-weather.json';
import seasonData from '../data/season-modifiers.json';
import envData from '../data/environment-modifiers.json';

type AxisWeights<K extends string> = Record<K, number>;

function weightedPick<K extends string>(rng: Rng, weights: AxisWeights<K>): K {
  const keys = Object.keys(weights) as K[];
  const w = keys.map((k) => Math.max(0, weights[k]));
  return pickFrom(rng, keys, w);
}

function applyMultipliers<K extends string>(
  base: AxisWeights<K>,
  multipliers: Partial<Record<K, number>> | undefined
): AxisWeights<K> {
  if (!multipliers) return base;
  const out = { ...base } as AxisWeights<K>;
  for (const k of Object.keys(multipliers) as K[]) {
    const m = multipliers[k];
    if (typeof m === 'number') out[k] = (out[k] ?? 0) * m;
  }
  return out;
}

function combinationValid(temp: Temperature, precip: Precipitation): boolean {
  if (precip === 'Heavy' && temp === 'Hot') return false;
  return true;
}

// Single source of truth for whether a weather state counts as "severe" for
// modifier-rule purposes. Lives next to Weather so any new severity-affecting
// field gets reflected here automatically.
export function weatherSeverity(w: Weather): 'Severe' | 'Mild' {
  if (w.precip === 'Heavy' || w.wind === 'High' || w.temp === 'Freezing' || w.temp === 'Hot')
    return 'Severe';
  return 'Mild';
}

export function rollWeather(inputs: Inputs, rng: Rng): Weather {
  const climate = (
    climateData as Record<
      string,
      {
        temp: AxisWeights<Temperature>;
        precip: AxisWeights<Precipitation>;
        wind: AxisWeights<Wind>;
      }
    >
  )[inputs.climate];
  const seasonMod = (
    seasonData as Record<string, Record<string, { temp?: Partial<Record<Temperature, number>> }>>
  )[inputs.climate]?.[inputs.season];
  const envMod = (
    envData as Record<
      string,
      { precip?: Partial<Record<Precipitation, number>>; wind?: Partial<Record<Wind, number>> }
    >
  )[inputs.environment];

  const tempWeights = applyMultipliers(climate.temp, seasonMod?.temp);
  const precipWeights = applyMultipliers(climate.precip, envMod?.precip);
  const windWeights = applyMultipliers(climate.wind, envMod?.wind);

  const temp = weightedPick(rng, tempWeights);
  let precip = weightedPick(rng, precipWeights);
  for (let i = 0; i < 5 && !combinationValid(temp, precip); i++) {
    precip = weightedPick(rng, precipWeights);
  }
  if (!combinationValid(temp, precip)) precip = 'Light';
  const wind = weightedPick(rng, windWeights);

  return {
    temp,
    precip,
    wind,
    narrative: narrate(temp, precip, wind, inputs.environment),
    effects: effectsFor(temp, precip, wind)
  };
}

function narrate(temp: Temperature, precip: Precipitation, wind: Wind, env: string): string {
  const tempPhrase: Record<Temperature, string> = {
    Freezing: 'Bitterly cold',
    Cold: 'Cold',
    Cool: 'Cool',
    Temperate: 'Mild',
    Warm: 'Warm',
    Hot: 'Sweltering'
  };
  const precipPhrase: Record<Precipitation, string> = {
    Clear: 'clear skies',
    Light: temp === 'Freezing' || temp === 'Cold' ? 'light snowfall' : 'a steady drizzle',
    Heavy: temp === 'Freezing' || temp === 'Cold' ? 'heavy snow' : 'driving rain'
  };
  const windPhrase: Record<Wind, string> = {
    None: 'still air',
    Low: 'a light breeze',
    High: 'strong winds'
  };
  if (env === 'Underground') {
    return `${tempPhrase[temp]}, in the close, still air of the caverns.`;
  }
  return `${tempPhrase[temp]}, with ${precipPhrase[precip]} and ${windPhrase[wind]}.`;
}

function effectsFor(temp: Temperature, precip: Precipitation, wind: Wind): WeatherEffect[] {
  const out: WeatherEffect[] = [];
  if (precip === 'Heavy' || wind === 'High') {
    out.push({
      id: 'perception-disadvantage',
      text: 'Disadvantage on Wisdom (Perception) checks relying on sight or hearing.',
      source: 'SRD'
    });
  }
  if (precip === 'Heavy' && (temp === 'Freezing' || temp === 'Cold')) {
    out.push({
      id: 'travel-pace-half',
      text: 'Travel pace halved while the snowstorm continues.',
      source: 'Original'
    });
  }
  if (wind === 'High') {
    out.push({
      id: 'ranged-disadvantage',
      text: 'Ranged weapon attacks have disadvantage in strong winds.',
      source: 'Original'
    });
  }
  if (temp === 'Freezing') {
    out.push({
      id: 'cold-exhaustion',
      text: 'Without cold-weather gear, each hour requires a DC 10 Constitution save or gain a level of exhaustion.',
      source: 'SRD'
    });
  }
  if (temp === 'Hot') {
    out.push({
      id: 'heat-exhaustion',
      text: 'Without water, each hour past 4 requires a DC 5 (+1 per hour) Constitution save or gain a level of exhaustion.',
      source: 'SRD'
    });
  }
  return out;
}
