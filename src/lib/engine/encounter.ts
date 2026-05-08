import type {
  Inputs,
  Weather,
  Monster,
  Encounter,
  ModifierRule,
  MonsterCategory,
  RegionType
} from './types';
import { type Rng, pickFrom, pickIndex } from './rng';
import modifiersData from '../data/encounter-modifiers.json';
import { parseModifiersFile, type ModifiersFile } from './validate';
import { weatherSeverity } from './weather';

const defaultModifiers = parseModifiersFile(modifiersData);

const ALL_CATEGORIES: MonsterCategory[] = [
  'Predator',
  'Bandit',
  'Civilised',
  'Undead',
  'Fey',
  'Aberration',
  'Construct',
  'Other'
];

function matches(rule: ModifierRule, inputs: Inputs, weather: Weather): boolean {
  const w = rule.when;
  if (w.climate && w.climate !== inputs.climate) return false;
  if (w.environment && w.environment !== inputs.environment) return false;
  if (w.season && w.season !== inputs.season) return false;
  if (w.time && w.time !== inputs.time) return false;
  if (w.region && w.region !== inputs.region) return false;
  if (w.mode && w.mode !== inputs.mode) return false;
  if (w.campfire !== undefined && w.campfire !== inputs.campfire) return false;
  if (w.noise !== undefined && w.noise !== inputs.noise) return false;
  if (w.weatherSeverity && w.weatherSeverity !== weatherSeverity(weather)) return false;
  return true;
}

export interface AppliedModifiers {
  encounterChance: number;
  categoryWeights: Record<MonsterCategory, number>;
  matchingRules: ModifierRule[];
}

export function applyModifiers(
  inputs: Inputs,
  weather: Weather,
  rules: ModifiersFile = defaultModifiers
): AppliedModifiers {
  let chance = rules.baseEncounterChance;
  const cat: Record<MonsterCategory, number> = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, 1])
  ) as Record<MonsterCategory, number>;
  const matchingRules: ModifierRule[] = [];

  for (const rule of rules.rules) {
    if (!matches(rule, inputs, weather)) continue;
    matchingRules.push(rule);
    // Number.isFinite guards against NaN and Infinity slipping through any future
    // path that bypasses parseModifiersFile (test fixtures, hand-edited data).
    if (Number.isFinite(rule.encounterChanceMultiplier))
      chance *= rule.encounterChanceMultiplier as number;
    if (rule.categoryMultipliers) {
      for (const c of ALL_CATEGORIES) {
        const m = rule.categoryMultipliers[c];
        if (Number.isFinite(m)) cat[c] *= m as number;
      }
    }
  }

  chance = Math.max(0, Math.min(1, chance));
  return { encounterChance: chance, categoryWeights: cat, matchingRules };
}

export interface CrWindow {
  min: number;
  max: number;
}

const REGION_BONUS: Record<RegionType, number> = {
  Settled: -1,
  Frontier: 0,
  Wilderness: 1,
  Hostile: 2
};

export function crWindow(level: number, size: number, region: RegionType): CrWindow {
  const min = Math.max(0, (level - 4) / 4);
  const baseMax = level * 0.85 + (size - 4) * 0.15;
  // max enforces both the 0.25 floor and the min <= max invariant; without the
  // outer Math.max(min, ...), a Settled low-level/low-size combination could
  // produce baseMax + bonus < min before hitting the 0.25 floor.
  const max = Math.max(min, Math.max(0.25, baseMax + REGION_BONUS[region]));
  return { min, max };
}

function inWindow(cr: number, w: CrWindow): boolean {
  return cr >= w.min && cr <= w.max;
}

export interface CheckResult {
  happens: boolean;
  chance: number;
}

export function encounterCheck(
  inputs: Inputs,
  weather: Weather,
  rng: Rng,
  mods?: AppliedModifiers
): CheckResult {
  const { encounterChance } = mods ?? applyModifiers(inputs, weather);
  return { happens: rng() < encounterChance, chance: encounterChance };
}

export interface PickResult {
  encounter: Encounter | null;
  message: string | null;
}

function decideCount(cr: number, level: number, size: number, rng: Rng): number {
  if (cr >= level) return 1;
  if (cr >= level / 2) return 1 + Math.floor(rng() * 2);
  if (cr >= 1) return 2 + Math.floor(rng() * Math.max(1, Math.min(4, size)));
  return 2 + Math.floor(rng() * Math.max(2, Math.min(6, size + 2)));
}

const IRREGULAR_PLURALS: Record<string, string> = {
  drow: 'drow',
  sheep: 'sheep',
  fish: 'fish',
  deer: 'deer'
};

function pluralise(name: string): string {
  const lower = name.toLowerCase();
  if (IRREGULAR_PLURALS[lower]) return IRREGULAR_PLURALS[lower];
  // "Swarm of X" stays singular ("4 swarm of bats" reads oddly but cleaner than appending 's' inside the phrase).
  if (lower.startsWith('swarm of ')) return lower;
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh'))
    return `${lower}es`;
  return `${lower}s`;
}

function indefiniteArticle(name: string): string {
  return /^[aeiou]/i.test(name) ? 'An' : 'A';
}

function buildNarrative(creature: Monster, count: number, rules: ModifierRule[]): string {
  const fragments = rules.map((r) => r.narrativeFragment).filter((f): f is string => Boolean(f));
  const subj =
    count === 1
      ? `${indefiniteArticle(creature.name)} ${creature.name.toLowerCase()}`
      : `${count} ${pluralise(creature.name)}`;
  const tail = fragments.length > 0 ? ` ${fragments.join(', ')}.` : '.';
  const verb = count === 1 ? 'appears' : 'appear';
  return `${subj} ${verb}${tail}`;
}

export function encounterPick(
  inputs: Inputs,
  weather: Weather,
  monsters: Monster[],
  rng: Rng,
  mods?: AppliedModifiers
): PickResult {
  const { categoryWeights, matchingRules } = mods ?? applyModifiers(inputs, weather);

  const envPool = monsters.filter((m) => m.environments.includes(inputs.environment));
  if (envPool.length === 0) {
    return {
      encounter: null,
      message: `No matching creatures for ${inputs.environment}. Try loosening filters.`
    };
  }

  const win = crWindow(inputs.partyLevel, inputs.partySize, inputs.region);
  const wide: CrWindow = { min: Math.max(0, win.min * 0.5), max: win.max * 1.5 };

  let pool = envPool.filter((m) => inWindow(m.cr, win));
  if (pool.length === 0) pool = envPool.filter((m) => inWindow(m.cr, wide));
  if (pool.length === 0) {
    return {
      encounter: null,
      message: `No matching creatures for this party level in ${inputs.environment}. Try loosening filters.`
    };
  }

  const byCat = new Map<MonsterCategory, Monster[]>();
  for (const m of pool) {
    if (!byCat.has(m.category)) byCat.set(m.category, []);
    byCat.get(m.category)!.push(m);
  }

  const cats = [...byCat.keys()];
  const catWeights = cats.map((c) => categoryWeights[c]);

  if (catWeights.every((w) => w <= 0)) {
    return {
      encounter: null,
      message: `Modifiers cancelled out all categories for ${inputs.environment}.`
    };
  }

  const chosenCat = cats[pickIndex(rng, catWeights)];
  const candidates = byCat.get(chosenCat)!;
  const creature = pickFrom(rng, candidates);
  const count = decideCount(creature.cr, inputs.partyLevel, inputs.partySize, rng);

  return {
    encounter: {
      creature,
      count,
      narrative: buildNarrative(creature, count, matchingRules),
      contributingModifiers: matchingRules.map((r) => r.id)
    },
    message: null
  };
}
