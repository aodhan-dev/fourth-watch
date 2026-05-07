/**
 * Snapshot Open5e v2 SRD creatures with rich stat-block data.
 * Run with: npm run fetch:monsters
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface NamedDesc {
  name: string;
  desc: string;
}

interface NormalisedMonster {
  slug: string;
  name: string;
  cr: number;
  type: string;
  size: string;
  environments: string[];
  hp: number;
  hitDice?: string;
  ac: number;
  acDetail?: string;
  speed: string;
  alignment?: string;
  proficiencyBonus?: number;
  xp?: number;
  abilityScores?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  savingThrows?: Record<string, number>;
  skills?: Record<string, number>;
  damageResistances?: string;
  damageImmunities?: string;
  damageVulnerabilities?: string;
  conditionImmunities?: string;
  senses?: string;
  passivePerception?: number;
  languages?: string;
  traits?: NamedDesc[];
  actions?: NamedDesc[];
  bonusActions?: NamedDesc[];
  reactions?: NamedDesc[];
  legendaryActions?: NamedDesc[];
  legendaryDesc?: string;
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

function mapEnvironment(label: string): string | null {
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

function mapEnvironments(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out = new Set<string>();
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
      return o.name && o.desc ? { name: o.name, desc: o.desc } : null;
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
    if (!o.name || !o.desc) continue;
    const item: NamedDesc = { name: o.name, desc: o.desc };
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
  return typeof o.as_string === 'string' ? o.as_string : '';
}

function pickResistances(r: unknown): {
  damageResistances?: string;
  damageImmunities?: string;
  damageVulnerabilities?: string;
  conditionImmunities?: string;
} {
  if (!r || typeof r !== 'object') return {};
  const o = r as Record<string, unknown>;
  const pull = (k: string) => (typeof o[k] === 'string' && o[k] ? (o[k] as string) : undefined);
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
  // Strip whichever prefix so categoriser overrides match either source.
  const stripped = (key ?? '').replace(/^srd[-_]?\d*_?/, '');
  return stripped || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function normaliseCreature(c: Open5eV2Creature, envs: string[]): NormalisedMonster {
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
    name: c.name,
    cr,
    type: nameOf(c.type),
    size: nameOf(c.size),
    environments: envs,
    hp: typeof c.hit_points === 'number' ? c.hit_points : 1,
    hitDice: c.hit_dice,
    ac: typeof c.armor_class === 'number' ? c.armor_class : 10,
    acDetail: c.armor_detail,
    speed: formatSpeed(c.speed),
    alignment: nameOf(c.alignment) || undefined,
    proficiencyBonus: c.proficiency_bonus,
    xp: c.experience_points,
    abilityScores,
    savingThrows: pickNumberRecord(c.saving_throws),
    skills: pickNumberRecord(c.skill_bonuses),
    ...resist,
    senses: senses || undefined,
    passivePerception: passive,
    languages: formatLanguages(c.languages) || undefined,
    traits: mapNamedDescs(c.traits),
    actions: grouped.actions,
    bonusActions: grouped.bonusActions,
    reactions: grouped.reactions,
    legendaryActions: grouped.legendaryActions
  };
}

async function main() {
  // Two passes:
  //   1. Pull all SRD creatures (5.1 and 5.2) into a flat list.
  //   2. Build a name→environments map from any source that has env tags (5.1 today).
  //   3. Dedupe by name, keeping the SRD 5.2 version when available, and inheriting
  //      environments from the 5.1 entry when 5.2 lacks them.
  const allCreatures: Open5eV2Creature[] = [];
  let url: string | null = 'https://api.open5e.com/v2/creatures/?limit=200';
  let page = 0;
  let raw = 0;
  while (url) {
    page++;
    process.stdout.write(`Fetching page ${page}... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const json = (await res.json()) as { results: Open5eV2Creature[]; next: string | null };
    raw += json.results.length;
    process.stdout.write(`${json.results.length} creatures\n`);
    for (const c of json.results) {
      if (!(c.document?.key ?? '').startsWith('srd')) continue;
      allCreatures.push(c);
    }
    url = json.next;
  }

  // Index environments by lowercased name across all SRD docs.
  const envByName = new Map<string, string[]>();
  for (const c of allCreatures) {
    const own = mapEnvironments(c.environments);
    if (own.length === 0) continue;
    const key = c.name.toLowerCase();
    const existing = envByName.get(key) ?? [];
    envByName.set(key, [...new Set([...existing, ...own])]);
  }

  // Pick the best version of each named creature: prefer SRD 5.2 over SRD 5.1.
  // This drops the 5.1 entry whenever 5.2 has the same creature.
  const bestByName = new Map<string, Open5eV2Creature>();
  for (const c of allCreatures) {
    const name = c.name.toLowerCase();
    const existing = bestByName.get(name);
    const isV2 = c.document?.key === 'srd-2024';
    const existingIsV2 = existing?.document?.key === 'srd-2024';
    if (!existing || (isV2 && !existingIsV2)) bestByName.set(name, c);
  }

  const out: NormalisedMonster[] = [];
  const stats = { fromV2: 0, fromV1: 0, withOwnEnv: 0, withInheritedEnv: 0, dropped: 0 };
  for (const c of bestByName.values()) {
    const own = mapEnvironments(c.environments);
    const inherited = envByName.get(c.name.toLowerCase()) ?? [];
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

  const path = join(process.cwd(), 'src/lib/data/monsters.json');
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${out.length} monsters (from ${raw} raw v2 results) to ${path}`);
  console.log(`  ${stats.fromV2} from SRD 5.2, ${stats.fromV1} from SRD 5.1 (5.1 entries dropped where 5.2 has same name)`);
  console.log(`  ${stats.withOwnEnv} with own environments, ${stats.withInheritedEnv} backfilled by name match`);
  console.log(`  ${stats.dropped} dropped (no environments in either edition)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
