import { describe, it, expect } from 'vitest';
import { parseMonsterCatalog, parseModifiersFile } from '../../src/lib/engine/validate';

const validMonster = {
  slug: 'wolf',
  name: 'Wolf',
  cr: 0.25,
  type: 'beast',
  size: 'Medium',
  environments: ['Forest'],
  hp: 11,
  ac: 13,
  speed: '40ft',
  category: 'Predator'
};

const validCatalog = { schemaVersion: 1, monsters: [validMonster] };

describe('parseMonsterCatalog', () => {
  it('accepts a valid envelope', () => {
    const out = parseMonsterCatalog(validCatalog);
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe('wolf');
  });

  it('rejects a bare array (pre-envelope shape)', () => {
    expect(() => parseMonsterCatalog([validMonster])).toThrow(/top-level/);
  });

  it('rejects a wrong schemaVersion', () => {
    expect(() => parseMonsterCatalog({ schemaVersion: 2, monsters: [validMonster] })).toThrow(
      /schemaVersion/
    );
  });

  it('rejects a missing schemaVersion', () => {
    expect(() => parseMonsterCatalog({ monsters: [validMonster] })).toThrow(/schemaVersion/);
  });

  it('rejects a non-array .monsters', () => {
    expect(() => parseMonsterCatalog({ schemaVersion: 1, monsters: 'oops' })).toThrow(/\.monsters/);
  });

  it('rejects an unknown environment', () => {
    const bad = { ...validMonster, environments: ['Marsh'] };
    expect(() => parseMonsterCatalog({ schemaVersion: 1, monsters: [bad] })).toThrow(/Environment/);
  });

  it('rejects an unknown category', () => {
    const bad = { ...validMonster, category: 'Robot' };
    expect(() => parseMonsterCatalog({ schemaVersion: 1, monsters: [bad] })).toThrow(
      /MonsterCategory/
    );
  });

  it('rejects a non-finite cr', () => {
    const bad = { ...validMonster, cr: NaN };
    expect(() => parseMonsterCatalog({ schemaVersion: 1, monsters: [bad] })).toThrow(/cr/);
  });

  it('rejects a missing slug', () => {
    const bad = { ...validMonster };
    delete (bad as Partial<typeof bad>).slug;
    expect(() => parseMonsterCatalog({ schemaVersion: 1, monsters: [bad] })).toThrow(/slug/);
  });
});

const validRule = {
  id: 'region-frontier',
  when: { region: 'Frontier' },
  encounterChanceMultiplier: 1.0,
  categoryMultipliers: { Bandit: 1.4 }
};

const validModifiers = {
  schemaVersion: 1,
  baseEncounterChance: 0.25,
  rules: [validRule]
};

describe('parseModifiersFile', () => {
  it('accepts a valid envelope', () => {
    const out = parseModifiersFile(validModifiers);
    expect(out.baseEncounterChance).toBe(0.25);
    expect(out.rules).toHaveLength(1);
  });

  it('rejects a missing schemaVersion', () => {
    expect(() => parseModifiersFile({ baseEncounterChance: 0.25, rules: [] })).toThrow(
      /schemaVersion/
    );
  });

  it('rejects baseEncounterChance outside [0, 1]', () => {
    expect(() =>
      parseModifiersFile({ schemaVersion: 1, baseEncounterChance: 1.5, rules: [] })
    ).toThrow(/baseEncounterChance/);
  });

  it('rejects an unknown category in categoryMultipliers', () => {
    const bad = {
      schemaVersion: 1,
      baseEncounterChance: 0.25,
      rules: [{ id: 'x', when: {}, categoryMultipliers: { Robot: 1 } }]
    };
    expect(() => parseModifiersFile(bad)).toThrow(/MonsterCategory/);
  });

  it('rejects a non-finite encounterChanceMultiplier', () => {
    const bad = {
      schemaVersion: 1,
      baseEncounterChance: 0.25,
      rules: [{ id: 'x', when: {}, encounterChanceMultiplier: Infinity }]
    };
    expect(() => parseModifiersFile(bad)).toThrow(/encounterChanceMultiplier/);
  });

  it('rejects a rule with missing id', () => {
    const bad = {
      schemaVersion: 1,
      baseEncounterChance: 0.25,
      rules: [{ when: {} }]
    };
    expect(() => parseModifiersFile(bad)).toThrow(/id/);
  });
});
