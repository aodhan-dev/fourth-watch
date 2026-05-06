/**
 * Reads monsters.json and writes it back with `category` field populated.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Category =
  | 'Predator'
  | 'Bandit'
  | 'Civilised'
  | 'Undead'
  | 'Fey'
  | 'Aberration'
  | 'Construct'
  | 'Other';

interface Monster {
  slug: string;
  name: string;
  type: string;
  category?: Category;
  [k: string]: unknown;
}

const path = join(process.cwd(), 'src/lib/data/monsters.json');
const overridesPath = join(process.cwd(), 'data-overrides/categories.json');

const monsters: Monster[] = JSON.parse(readFileSync(path, 'utf8'));
const overrides: Record<string, Category> = JSON.parse(readFileSync(overridesPath, 'utf8'));

function categoriseByType(type: string): Category {
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

writeFileSync(path, JSON.stringify(monsters, null, 2));
console.log(
  `Categorised ${monsters.length} monsters: ${overridesApplied} from overrides, ${heuristic} from type heuristics.`
);
