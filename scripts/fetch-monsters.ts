/**
 * Snapshot Open5e v2 SRD creatures with rich stat-block data.
 * Run with: npm run fetch:monsters
 */
import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment, MonsterRaw, NamedDesc } from '../src/lib/engine/types';

const OPEN5E_HOST = 'https://api.open5e.com/';

// Length caps for strings we bake into the client bundle. A compromised or
// malformed Open5e response cannot blow up the bundle or sneak attacker-controlled
// prose past these. Svelte's mustache escaping handles HTML/JS injection separately;
// safeString only enforces shape and size.
const MAX_NAME = 80;
const MAX_DETAIL = 200;
const MAX_DESC = 4000;

function safeString(s: unknown, maxLen: number): string | undefined {
  if (typeof s !== 'string' || s.length === 0) return undefined;
  // Reject obvious script/iframe payloads outright; truncate the rest.
  if (/<script|<iframe|javascript:/i.test(s)) return undefined;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function nameOf(v: unknown): string {
  if (typeof v === 'string') return v;
  if (
    v &&
    typeof v === 'object' &&
    'name' in v &&
    typeof (v as { name: string }).name === 'string'
  ) {
    return (v as { name: string }).name;
  }
  return '';
}

function mapEnvironment(label: string): Environment | null {
  const n = label.toLowerCase();
  if (/arctic|tundra|polar|ice/.test(n)) return 'Arctic';
  if (/coast|shore|beach|sea|ocean/.test(n)) return 'Coastal';
  if (/desert|dunes/.test(n)) return 'Desert';
  if (/forest|jungle|wood/.test(n)) return 'Forest';
  if (/grassland|plain|prairie|savann|steppe/.test(n)) return 'Grassland';
  if (/hill/.test(n)) return 'Hills';
  if (/mountain|alpine|peak/.test(n)) return 'Mountains';
  if (/swamp|marsh|bog|fen|wetland/.test(n)) return 'Swamp';
  if (/underdark|underground|cave|cavern|subterranean/.test(n)) return 'Underground';
  if (/urban|city|town|village|settle/.test(n)) return 'Urban';
  if (/wasteland|barren|ruin|blight/.test(n)) return 'Wasteland';
  return null;
}

function mapEnvironments(arr: unknown): Environment[] {
  if (!Array.isArray(arr)) return [];
  const out = new Set<Environment>();
  for (const e of arr) {
    const tag = mapEnvironment(nameOf(e));
    if (tag) out.add(tag);
  }
  return [...out];
}

function formatSpeed(speed: unknown): string {
  if (!speed || typeof speed !== 'object') return '';
  const s = speed as Record<string, unknown>;
  const unit = (s.unit as string) ?? 'feet';
  const u = unit === 'feet' ? 'ft' : unit;
  return Object.entries(s)
    .filter(([k, v]) => k !== 'unit' && typeof v === 'number' && (v as number) > 0)
    .map(([k, v]) => (k === 'walk' ? `${v} ${u}` : `${k} ${v} ${u}`))
    .join(', ');
}

function mapNamedDescs(arr: unknown): NamedDesc[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr
    .map((a) => {
      const o = a as { name?: string; desc?: string };
      const name = safeString(o.name, MAX_NAME);
      const desc = safeString(o.desc, MAX_DESC);
      return name && desc ? { name, desc } : null;
    })
    .filter((x): x is NamedDesc => x !== null);
}

function classifyActions(arr: unknown): {
  actions: NamedDesc[];
  bonusActions: NamedDesc[];
  reactions: NamedDesc[];
  legendaryActions: NamedDesc[];
} {
  const out = {
    actions: [] as NamedDesc[],
    bonusActions: [] as NamedDesc[],
    reactions: [] as NamedDesc[],
    legendaryActions: [] as NamedDesc[]
  };
  if (!Array.isArray(arr)) return out;
  for (const a of arr) {
    const o = a as { name?: string; desc?: string; action_type?: string };
    const name = safeString(o.name, MAX_NAME);
    const desc = safeString(o.desc, MAX_DESC);
    if (!name || !desc) continue;
    const item: NamedDesc = { name, desc };
    switch (o.action_type) {
      case 'BONUS':
        out.bonusActions.push(item);
        break;
      case 'REACTION':
        out.reactions.push(item);
        break;
      case 'LEGENDARY':
        out.legendaryActions.push(item);
        break;
      default:
        out.actions.push(item);
    }
  }
  return out;
}

function pickNumberRecord(obj: unknown): Record<string, number> | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function formatSenses(c: Record<string, unknown>): { senses: string; passive?: number } {
  const parts: string[] = [];
  const ranges: Array<[string, unknown]> = [
    ['darkvision', c.darkvision_range],
    ['blindsight', c.blindsight_range],
    ['tremorsense', c.tremorsense_range],
    ['truesight', c.truesight_range]
  ];
  for (const [name, value] of ranges) {
    if (typeof value === 'number' && value > 0) parts.push(`${name} ${value} ft.`);
  }
  const passive = typeof c.passive_perception === 'number' ? c.passive_perception : undefined;
  if (passive !== undefined) parts.push(`passive Perception ${passive}`);
  return { senses: parts.join(', '), passive };
}

function formatLanguages(langs: unknown): string {
  if (!langs || typeof langs !== 'object') return '';
  const o = langs as { as_string?: string };
  return safeString(o.as_string, MAX_DETAIL) ?? '';
}

function pickResistances(r: unknown): {
  damageResistances?: string;
  damageImmunities?: string;
  damageVulnerabilities?: string;
  conditionImmunities?: string;
} {
  if (!r || typeof r !== 'object') return {};
  const o = r as Record<string, unknown>;
  const pull = (k: string) => safeString(o[k], MAX_DETAIL);
  return {
    damageResistances: pull('damage_resistances_display'),
    damageImmunities: pull('damage_immunities_display'),
    damageVulnerabilities: pull('damage_vulnerabilities_display'),
    conditionImmunities: pull('condition_immunities_display')
  };
}

interface Open5eV2Creature {
  key?: string;
  name: string;
  challenge_rating?: number | string;
  type?: unknown;
  size?: unknown;
  alignment?: unknown;
  hit_points?: number;
  hit_dice?: string;
  armor_class?: number;
  armor_detail?: string;
  speed?: unknown;
  ability_scores?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
  saving_throws?: unknown;
  skill_bonuses?: unknown;
  proficiency_bonus?: number;
  experience_points?: number;
  resistances_and_immunities?: unknown;
  passive_perception?: number;
  darkvision_range?: number | null;
  blindsight_range?: number | null;
  tremorsense_range?: number | null;
  truesight_range?: number | null;
  languages?: unknown;
  traits?: unknown;
  actions?: unknown;
  environments?: unknown;
  document?: { key?: string };
}

function parseCrString(v: string): number {
  if (v.includes('/')) {
    const [a, b] = v.split('/').map(Number);
    return a / b;
  }
  return Number(v) || 0;
}

function normaliseSlug(key: string | undefined, name: string): string {
  // SRD keys: 'srd_wolf' (5.1) or 'srd2024_wolf' / 'srd-2024_wolf' (5.2).
  // Strip whichever prefix so categoriser overrides at data-overrides/categories.json
  // match either edition with a single bare slug. Edition is tracked on the Monster
  // record separately so dedupe and rename detection don't rely on this collapse.
  const stripped = (key ?? '').replace(/^srd[-_]?\d*_?/, '');
  return stripped || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function editionOf(documentKey: string | undefined): '5.1' | '5.2' | undefined {
  if (documentKey === 'srd-2024') return '5.2';
  if (documentKey && documentKey.startsWith('srd')) return '5.1';
  return undefined;
}

function normaliseCreature(c: Open5eV2Creature, envs: Environment[]): MonsterRaw {
  const cr =
    typeof c.challenge_rating === 'number'
      ? c.challenge_rating
      : typeof c.challenge_rating === 'string'
        ? parseCrString(c.challenge_rating)
        : 0;

  const a = c.ability_scores ?? {};
  const abilityScores =
    typeof a.strength === 'number'
      ? {
          str: a.strength,
          dex: a.dexterity ?? 10,
          con: a.constitution ?? 10,
          int: a.intelligence ?? 10,
          wis: a.wisdom ?? 10,
          cha: a.charisma ?? 10
        }
      : undefined;

  const { senses, passive } = formatSenses(c as unknown as Record<string, unknown>);
  const resist = pickResistances(c.resistances_and_immunities);
  const grouped = classifyActions(c.actions);

  return {
    slug: normaliseSlug(c.key, c.name),
    edition: editionOf(c.document?.key),
    name: safeString(c.name, MAX_NAME) ?? c.name.slice(0, MAX_NAME),
    cr,
    type: nameOf(c.type).slice(0, MAX_NAME),
    size: nameOf(c.size).slice(0, MAX_NAME),
    environments: envs,
    hp: typeof c.hit_points === 'number' ? c.hit_points : 1,
    hitDice: safeString(c.hit_dice, MAX_DETAIL),
    ac: typeof c.armor_class === 'number' ? c.armor_class : 10,
    acDetail: safeString(c.armor_detail, MAX_DETAIL),
    speed: formatSpeed(c.speed).slice(0, MAX_DETAIL),
    alignment: safeString(nameOf(c.alignment), MAX_NAME),
    proficiencyBonus: typeof c.proficiency_bonus === 'number' ? c.proficiency_bonus : undefined,
    xp: c.experience_points,
    abilityScores,
    savingThrows: pickNumberRecord(c.saving_throws),
    skills: pickNumberRecord(c.skill_bonuses),
    ...resist,
    senses: senses ? safeString(senses, MAX_DETAIL) : undefined,
    passivePerception: passive,
    languages: safeString(formatLanguages(c.languages), MAX_DETAIL),
    traits: mapNamedDescs(c.traits),
    actions: grouped.actions,
    bonusActions: grouped.bonusActions,
    reactions: grouped.reactions,
    legendaryActions: grouped.legendaryActions
  };
}

interface DedupeDropEntry {
  slug: string;
  keptEdition: '5.1' | '5.2' | 'unknown';
  droppedEdition: '5.1' | '5.2' | 'unknown';
  keptName: string;
  droppedName: string;
}

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) {
      const delay = 1000 * 2 ** i;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${String(lastErr)}`);
}

function safeNextUrl(next: unknown): string | null {
  if (typeof next !== 'string' || next.length === 0) return null;
  if (!next.startsWith(OPEN5E_HOST)) {
    console.warn(`Refusing to follow off-host pagination URL: ${next}`);
    return null;
  }
  return next;
}

async function main() {
  // Pull every SRD creature (5.1 and 5.2), dedupe by bare slug preferring 5.2,
  // and inherit environments from sibling editions when the kept entry lacks them.
  // Slug is used for dedupe instead of name so a 5.1 to 5.2 rename does not produce
  // two entries for the same creature; renames are logged so semantic drift can be reviewed.
  const allCreatures: Open5eV2Creature[] = [];
  let url: string | null = `${OPEN5E_HOST}v2/creatures/?limit=200`;
  let page = 0;
  let raw = 0;
  while (url) {
    page++;
    process.stdout.write(`Fetching page ${page}... `);
    const res = await fetchWithRetry(url);
    const json = (await res.json()) as { results: Open5eV2Creature[]; next: unknown };
    raw += json.results.length;
    process.stdout.write(`${json.results.length} creatures\n`);
    for (const c of json.results) {
      if (!(c.document?.key ?? '').startsWith('srd')) continue;
      allCreatures.push(c);
    }
    url = safeNextUrl(json.next);
  }

  // Index environments by bare slug across all SRD docs (5.1 currently carries env tags;
  // 5.2 frequently lacks them).
  const envBySlug = new Map<string, Environment[]>();
  for (const c of allCreatures) {
    const own = mapEnvironments(c.environments);
    if (own.length === 0) continue;
    const slug = normaliseSlug(c.key, c.name);
    const existing = envBySlug.get(slug) ?? [];
    envBySlug.set(slug, [...new Set([...existing, ...own])]);
  }

  // Slug-keyed dedupe, prefer SRD 5.2. Log every drop.
  const bestBySlug = new Map<string, Open5eV2Creature>();
  const drops: DedupeDropEntry[] = [];
  for (const c of allCreatures) {
    const slug = normaliseSlug(c.key, c.name);
    const ed = editionOf(c.document?.key) ?? 'unknown';
    const prior = bestBySlug.get(slug);
    if (!prior) {
      bestBySlug.set(slug, c);
      continue;
    }
    const priorEd = editionOf(prior.document?.key) ?? 'unknown';
    const newWins = ed === '5.2' && priorEd !== '5.2';
    const winner = newWins ? c : prior;
    const loser = newWins ? prior : c;
    bestBySlug.set(slug, winner);
    drops.push({
      slug,
      keptEdition: editionOf(winner.document?.key) ?? 'unknown',
      droppedEdition: editionOf(loser.document?.key) ?? 'unknown',
      keptName: winner.name,
      droppedName: loser.name
    });
  }

  const out: MonsterRaw[] = [];
  const stats = { fromV2: 0, fromV1: 0, withOwnEnv: 0, withInheritedEnv: 0, dropped: 0 };
  for (const c of bestBySlug.values()) {
    const own = mapEnvironments(c.environments);
    const slug = normaliseSlug(c.key, c.name);
    const inherited = envBySlug.get(slug) ?? [];
    const envs = own.length > 0 ? own : inherited;
    if (envs.length === 0) {
      stats.dropped++;
      continue;
    }
    if (own.length > 0) stats.withOwnEnv++;
    else stats.withInheritedEnv++;
    if (c.document?.key === 'srd-2024') stats.fromV2++;
    else stats.fromV1++;
    out.push(normaliseCreature(c, envs));
  }

  if (out.length < 50) {
    throw new Error(`Suspiciously few SRD monsters with environments: ${out.length}. Aborting.`);
  }

  // Atomic write: serialise to .tmp first, then rename, so an interrupt mid-write
  // can never leave monsters.json in a partial state.
  const path = join(process.cwd(), 'src/lib/data/monsters.json');
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify({ schemaVersion: 1, monsters: out }, null, 2));
  renameSync(tmp, path);
  console.log(`\nWrote ${out.length} monsters (from ${raw} raw v2 results) to ${path}`);
  console.log(
    `  ${stats.fromV2} from SRD 5.2, ${stats.fromV1} from SRD 5.1 (${drops.length} duplicates dropped during slug dedupe)`
  );
  console.log(
    `  ${stats.withOwnEnv} with own environments, ${stats.withInheritedEnv} backfilled from sibling edition`
  );
  console.log(`  ${stats.dropped} dropped (no environments in any edition)`);
  const renames = drops.filter((d) => d.keptName !== d.droppedName);
  if (renames.length > 0) {
    console.log(`\n${renames.length} renamed across editions (review for semantic drift):`);
    for (const r of renames) {
      console.log(
        `  ${r.slug}: kept "${r.keptName}" (${r.keptEdition}), dropped "${r.droppedName}" (${r.droppedEdition})`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
