import { describe, it, expect } from 'vitest';
import { parseMonsterCatalog, parseModifiersFile } from '../../src/lib/engine/validate';
import monstersRaw from '../../src/lib/data/monsters.json';
import modifiersRaw from '../../src/lib/data/encounter-modifiers.json';
import climateRaw from '../../src/lib/data/climate-weather.json';

const CLIMATES = ['Tropical', 'Subtropical', 'Arid', 'Temperate', 'Subarctic', 'Arctic'] as const;
const TEMP_KEYS = ['Freezing', 'Cold', 'Cool', 'Temperate', 'Warm', 'Hot'] as const;
const PRECIP_KEYS = ['Clear', 'Light', 'Heavy'] as const;
const WIND_KEYS = ['None', 'Low', 'High'] as const;

describe('monsters.json schema contract', () => {
  it('parses through the runtime validator without errors', () => {
    expect(() => parseMonsterCatalog(monstersRaw)).not.toThrow();
  });

  it('returns a non-empty monster array', () => {
    const monsters = parseMonsterCatalog(monstersRaw);
    expect(monsters.length).toBeGreaterThan(0);
  });

  it('every monster has a non-empty slug and name', () => {
    const monsters = parseMonsterCatalog(monstersRaw);
    for (const m of monsters) {
      expect(m.slug.length).toBeGreaterThan(0);
      expect(m.name.length).toBeGreaterThan(0);
    }
  });

  it('every monster cr is a finite non-negative number', () => {
    const monsters = parseMonsterCatalog(monstersRaw);
    for (const m of monsters) {
      expect(Number.isFinite(m.cr)).toBe(true);
      expect(m.cr).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('encounter-modifiers.json schema contract', () => {
  it('parses through the runtime validator without errors', () => {
    expect(() => parseModifiersFile(modifiersRaw)).not.toThrow();
  });

  it('baseEncounterChance is in [0, 1]', () => {
    const mods = parseModifiersFile(modifiersRaw);
    expect(mods.baseEncounterChance).toBeGreaterThanOrEqual(0);
    expect(mods.baseEncounterChance).toBeLessThanOrEqual(1);
  });

  it('every rule has a non-empty id and a when object', () => {
    const mods = parseModifiersFile(modifiersRaw);
    for (const rule of mods.rules) {
      expect(typeof rule.id).toBe('string');
      expect(rule.id.length).toBeGreaterThan(0);
      expect(typeof rule.when).toBe('object');
    }
  });
});

describe('climate-weather.json schema contract', () => {
  const data = climateRaw as Record<
    string,
    { temp: Record<string, number>; precip: Record<string, number>; wind: Record<string, number> }
  >;

  it('has an entry for every climate', () => {
    for (const c of CLIMATES) {
      expect(data[c]).toBeDefined();
    }
  });

  it('every climate has temp, precip, and wind axes', () => {
    for (const c of CLIMATES) {
      expect(data[c].temp).toBeDefined();
      expect(data[c].precip).toBeDefined();
      expect(data[c].wind).toBeDefined();
    }
  });

  it('temp axis has all required keys with non-negative numbers', () => {
    for (const c of CLIMATES) {
      for (const k of TEMP_KEYS) {
        expect(typeof data[c].temp[k]).toBe('number');
        expect(data[c].temp[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('precip axis has all required keys with non-negative numbers', () => {
    for (const c of CLIMATES) {
      for (const k of PRECIP_KEYS) {
        expect(typeof data[c].precip[k]).toBe('number');
        expect(data[c].precip[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('wind axis has all required keys with non-negative numbers', () => {
    for (const c of CLIMATES) {
      for (const k of WIND_KEYS) {
        expect(typeof data[c].wind[k]).toBe('number');
        expect(data[c].wind[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('each climate weights sum to a positive total on every axis', () => {
    for (const c of CLIMATES) {
      const tempSum = TEMP_KEYS.reduce((s, k) => s + data[c].temp[k], 0);
      const precipSum = PRECIP_KEYS.reduce((s, k) => s + data[c].precip[k], 0);
      const windSum = WIND_KEYS.reduce((s, k) => s + data[c].wind[k], 0);
      expect(tempSum).toBeGreaterThan(0);
      expect(precipSum).toBeGreaterThan(0);
      expect(windSum).toBeGreaterThan(0);
    }
  });
});
