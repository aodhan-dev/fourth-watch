/**
 * Reads monsters.json and writes it back with `category` field populated.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MonsterCategory, MonsterRaw } from '../src/lib/engine/types';

type Categorisable = MonsterRaw & { category?: MonsterCategory };

interface MonsterCatalog {
  schemaVersion: number;
  monsters: Categorisable[];
}

const SCHEMA_VERSION = 1;
const path = join(process.cwd(), 'src/lib/data/monsters.json');
const overridesPath = join(process.cwd(), 'data-overrides/categories.json');

const catalog: MonsterCatalog = JSON.parse(readFileSync(path, 'utf8'));
if (catalog.schemaVersion !== SCHEMA_VERSION) {
  throw new Error(
    `monsters.json schemaVersion ${catalog.schemaVersion} is not compatible with this script (expected ${SCHEMA_VERSION}). Re-run fetch-monsters.`
  );
}
const monsters = catalog.monsters;
const overrides: Record<string, MonsterCategory> = JSON.parse(readFileSync(overridesPath, 'utf8'));

function categoriseByType(type: string): MonsterCategory {
  const t = type.toLowerCase();
  if (t.includes('undead')) return 'Undead';
  if (t.includes('fey')) return 'Fey';
  if (t.includes('aberration')) return 'Aberration';
  if (t.includes('construct')) return 'Construct';
  if (t.includes('beast') || t.includes('monstrosity') || t.includes('dragon')) return 'Predator';
  if (t.includes('humanoid')) return 'Bandit';
  if (t.includes('giant')) return 'Predator';
  if (t.includes('plant')) return 'Predator';
  if (t.includes('elemental')) return 'Other';
  if (t.includes('celestial')) return 'Civilised';
  if (t.includes('fiend')) return 'Predator';
  return 'Other';
}

let overridesApplied = 0;
let heuristic = 0;
for (const m of monsters) {
  if (overrides[m.slug]) {
    m.category = overrides[m.slug];
    overridesApplied++;
  } else {
    m.category = categoriseByType(m.type);
    heuristic++;
  }
}

writeFileSync(path, JSON.stringify({ schemaVersion: SCHEMA_VERSION, monsters }, null, 2));
console.log(
  `Categorised ${monsters.length} monsters: ${overridesApplied} from overrides, ${heuristic} from type heuristics.`
);
