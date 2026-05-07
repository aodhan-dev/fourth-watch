import type { Environment, Monster, MonsterCategory, ModifierRule } from './types';

const MONSTERS_SCHEMA_VERSION = 1;
const MODIFIERS_SCHEMA_VERSION = 1;

const ENVIRONMENTS: ReadonlySet<Environment> = new Set<Environment>([
  'Arctic',
  'Coastal',
  'Desert',
  'Forest',
  'Grassland',
  'Hills',
  'Mountains',
  'Swamp',
  'Underground',
  'Urban',
  'Wasteland'
]);

const CATEGORIES: ReadonlySet<MonsterCategory> = new Set<MonsterCategory>([
  'Predator',
  'Bandit',
  'Civilised',
  'Undead',
  'Fey',
  'Aberration',
  'Construct',
  'Other'
]);

class DataShapeError extends Error {
  constructor(file: string, path: string, detail: string) {
    super(`${file}: ${path} ${detail}`);
    this.name = 'DataShapeError';
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseMonster(raw: unknown, file: string, idx: number): Monster {
  const path = `monsters[${idx}]`;
  if (!isObject(raw)) throw new DataShapeError(file, path, 'is not an object');

  const slug = raw.slug;
  if (typeof slug !== 'string' || slug.length === 0)
    throw new DataShapeError(file, `${path}.slug`, 'is not a non-empty string');

  const name = raw.name;
  if (typeof name !== 'string' || name.length === 0)
    throw new DataShapeError(file, `${path}.name`, 'is not a non-empty string');

  if (!isFiniteNumber(raw.cr))
    throw new DataShapeError(file, `${path}.cr`, 'is not a finite number');

  if (typeof raw.type !== 'string')
    throw new DataShapeError(file, `${path}.type`, 'is not a string');

  if (typeof raw.size !== 'string')
    throw new DataShapeError(file, `${path}.size`, 'is not a string');

  if (!Array.isArray(raw.environments))
    throw new DataShapeError(file, `${path}.environments`, 'is not an array');
  for (let i = 0; i < raw.environments.length; i++) {
    const e = raw.environments[i];
    if (typeof e !== 'string' || !ENVIRONMENTS.has(e as Environment))
      throw new DataShapeError(file, `${path}.environments[${i}]`, `is not a known Environment: ${String(e)}`);
  }

  if (!isFiniteNumber(raw.hp)) throw new DataShapeError(file, `${path}.hp`, 'is not a finite number');
  if (!isFiniteNumber(raw.ac)) throw new DataShapeError(file, `${path}.ac`, 'is not a finite number');

  if (typeof raw.speed !== 'string')
    throw new DataShapeError(file, `${path}.speed`, 'is not a string');

  if (typeof raw.category !== 'string' || !CATEGORIES.has(raw.category as MonsterCategory))
    throw new DataShapeError(file, `${path}.category`, `is not a known MonsterCategory: ${String(raw.category)}`);

  // Optional fields are passed through without per-field validation; the engine reads them
  // defensively (formatNumberMap ignores non-numeric values, etc.). Tightening these is a
  // separate concern handled by the test-coverage-uplift branch.
  return raw as unknown as Monster;
}

export function parseMonsterCatalog(raw: unknown): Monster[] {
  const file = 'monsters.json';
  if (!isObject(raw)) throw new DataShapeError(file, '', 'top-level is not an object envelope');
  if (raw.schemaVersion !== MONSTERS_SCHEMA_VERSION)
    throw new DataShapeError(
      file,
      '.schemaVersion',
      `expected ${MONSTERS_SCHEMA_VERSION}, got ${String(raw.schemaVersion)}`
    );
  if (!Array.isArray(raw.monsters))
    throw new DataShapeError(file, '.monsters', 'is not an array');
  return raw.monsters.map((m, i) => parseMonster(m, file, i));
}

function parseModifierRule(raw: unknown, file: string, idx: number): ModifierRule {
  const path = `rules[${idx}]`;
  if (!isObject(raw)) throw new DataShapeError(file, path, 'is not an object');
  if (typeof raw.id !== 'string' || raw.id.length === 0)
    throw new DataShapeError(file, `${path}.id`, 'is not a non-empty string');
  if (!isObject(raw.when))
    throw new DataShapeError(file, `${path}.when`, 'is not an object');
  if (raw.encounterChanceMultiplier !== undefined && !isFiniteNumber(raw.encounterChanceMultiplier))
    throw new DataShapeError(file, `${path}.encounterChanceMultiplier`, 'is not a finite number');
  if (raw.categoryMultipliers !== undefined) {
    if (!isObject(raw.categoryMultipliers))
      throw new DataShapeError(file, `${path}.categoryMultipliers`, 'is not an object');
    for (const [k, v] of Object.entries(raw.categoryMultipliers)) {
      if (!CATEGORIES.has(k as MonsterCategory))
        throw new DataShapeError(file, `${path}.categoryMultipliers.${k}`, 'is not a known MonsterCategory');
      if (!isFiniteNumber(v))
        throw new DataShapeError(file, `${path}.categoryMultipliers.${k}`, 'is not a finite number');
    }
  }
  return raw as unknown as ModifierRule;
}

export interface ModifiersFile {
  schemaVersion: number;
  baseEncounterChance: number;
  rules: ModifierRule[];
}

export function parseModifiersFile(raw: unknown): ModifiersFile {
  const file = 'encounter-modifiers.json';
  if (!isObject(raw)) throw new DataShapeError(file, '', 'top-level is not an object');
  if (raw.schemaVersion !== MODIFIERS_SCHEMA_VERSION)
    throw new DataShapeError(
      file,
      '.schemaVersion',
      `expected ${MODIFIERS_SCHEMA_VERSION}, got ${String(raw.schemaVersion)}`
    );
  if (!isFiniteNumber(raw.baseEncounterChance) || raw.baseEncounterChance < 0 || raw.baseEncounterChance > 1)
    throw new DataShapeError(file, '.baseEncounterChance', 'is not a finite number in [0, 1]');
  if (!Array.isArray(raw.rules))
    throw new DataShapeError(file, '.rules', 'is not an array');
  const rules = raw.rules.map((r, i) => parseModifierRule(r, file, i));
  return {
    schemaVersion: MONSTERS_SCHEMA_VERSION,
    baseEncounterChance: raw.baseEncounterChance,
    rules
  };
}
