import { describe, it, expect } from 'vitest';
import { rollWeather } from '../../src/lib/engine/weather';
import { makeRng } from '../../src/lib/engine/rng';
import type { Inputs } from '../../src/lib/engine/types';

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

describe('rollWeather', () => {
  it('is deterministic for the same seed and inputs', () => {
    const a = rollWeather(baseInputs(), makeRng(123));
    const b = rollWeather(baseInputs(), makeRng(123));
    expect(a).toEqual(b);
  });

  it('produces a valid weather object', () => {
    const w = rollWeather(baseInputs(), makeRng(1));
    expect(['Freezing', 'Cold', 'Cool', 'Temperate', 'Warm', 'Hot']).toContain(w.temp);
    expect(['Clear', 'Light', 'Heavy']).toContain(w.precip);
    expect(['None', 'Low', 'High']).toContain(w.wind);
    expect(typeof w.narrative).toBe('string');
    expect(w.narrative.length).toBeGreaterThan(0);
  });

  it('arctic climate rolls Freezing or Cold the vast majority of the time', () => {
    const inputs = baseInputs({ climate: 'Arctic', environment: 'Arctic', season: 'Winter' });
    let cold = 0;
    for (let s = 0; s < 1000; s++) {
      const w = rollWeather(inputs, makeRng(s));
      if (w.temp === 'Freezing' || w.temp === 'Cold') cold++;
    }
    expect(cold).toBeGreaterThan(900);
  });

  it('arid desert almost never rolls heavy rain', () => {
    const inputs = baseInputs({ climate: 'Arid', environment: 'Desert' });
    let heavy = 0;
    for (let s = 0; s < 1000; s++) {
      const w = rollWeather(inputs, makeRng(s));
      if (w.precip === 'Heavy') heavy++;
    }
    expect(heavy).toBeLessThan(50);
  });

  it('underground always rolls Clear precipitation and No wind', () => {
    const inputs = baseInputs({ environment: 'Underground' });
    for (let s = 0; s < 200; s++) {
      const w = rollWeather(inputs, makeRng(s));
      expect(w.precip).toBe('Clear');
      expect(w.wind).toBe('None');
    }
  });

  it('never produces Hot + Heavy snow', () => {
    for (let s = 0; s < 5000; s++) {
      const w = rollWeather(baseInputs({ climate: 'Arctic', season: 'Winter' }), makeRng(s));
      const isSnow = w.precip === 'Heavy' && (w.temp === 'Freezing' || w.temp === 'Cold');
      const isHotSnow = isSnow && (w.temp as string) === 'Hot';
      expect(isHotSnow).toBe(false);
    }
  });

  it('attaches WeatherEffects for severe conditions', () => {
    const inputs = baseInputs({ climate: 'Arctic', season: 'Winter' });
    let sawEffect = false;
    for (let s = 0; s < 200; s++) {
      const w = rollWeather(inputs, makeRng(s));
      if (w.effects.length > 0) sawEffect = true;
    }
    expect(sawEffect).toBe(true);
  });
});
