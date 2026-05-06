/**
 * One-shot snapshot of Open5e SRD monsters.
 * Run with: npm run fetch:monsters
 *
 * Uses Open5e v1 API which has environment tags on SRD creatures.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Maps Open5e v1 environment strings to our canonical Environment type.
// Unmapped values are dropped (non-terrain planes, abstract locations, etc.).
const ENV_MAP: Record<string, string> = {
  arctic: 'Arctic',
  tundra: 'Arctic',
  coastal: 'Coastal',
  desert: 'Desert',
  forest: 'Forest',
  jungle: 'Forest',
  grassland: 'Grassland',
  hill: 'Hills',
  hills: 'Hills',
  mountain: 'Mountains',
  mountains: 'Mountains',
  swamp: 'Swamp',
  underdark: 'Underground',
  caves: 'Underground',
  caverns: 'Underground',
  underground: 'Underground',
  underwater: 'Underground',
  urban: 'Urban',
  settlement: 'Urban',
  wasteland: 'Wasteland'
};

interface V1Monster {
  slug: string;
  name: string;
  cr: number;
  challenge_rating: string;
  type: string;
  size: string;
  environments: string[];
  hit_points: number;
  armor_class: number;
  speed: Record<string, number>;
  document__slug: string;
}

interface NormalisedMonster {
  slug: string;
  name: string;
  cr: number;
  type: string;
  size: string;
  environments: string[];
  hp: number;
  ac: number;
  speed: string;
  statblock: string;
}

function parseCr(v: number | string): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    if (v.includes('/')) {
      const [a, b] = v.split('/').map(Number);
      return a / b;
    }
    return Number(v) || 0;
  }
  return 0;
}

function parseSpeed(speed: Record<string, number>): string {
  if (!speed || typeof speed !== 'object') return '';
  return Object.entries(speed)
    .filter(([, n]) => typeof n === 'number' && n > 0)
    .map(([k, n]) => `${k} ${n}ft`)
    .join(', ');
}

function normaliseEnvs(arr: string[]): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const e of arr) {
    const mapped = ENV_MAP[e.toLowerCase().trim()];
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      result.push(mapped);
    }
  }
  return result;
}

async function main() {
  const out: NormalisedMonster[] = [];
  let url: string | null = 'https://api.open5e.com/v1/monsters/?limit=200&document__slug=wotc-srd';
  let page = 0;

  while (url) {
    page++;
    process.stdout.write(`Fetching page ${page}... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const json = (await res.json()) as { results: V1Monster[]; next: string | null };
    process.stdout.write(`${json.results.length} creatures\n`);

    for (const c of json.results) {
      const envs = normaliseEnvs(c.environments ?? []);
      if (envs.length === 0) continue;
      out.push({
        slug: c.slug,
        name: c.name,
        cr: parseCr(c.cr ?? c.challenge_rating),
        type: c.type ?? '',
        size: c.size ?? '',
        environments: envs,
        hp: c.hit_points ?? 1,
        ac: c.armor_class ?? 10,
        speed: parseSpeed(c.speed ?? {}),
        statblock: ''
      });
    }
    url = json.next;
  }

  if (out.length < 50) {
    throw new Error(`Suspiciously few SRD monsters with environments: ${out.length}. Aborting.`);
  }

  const path = join(process.cwd(), 'src/lib/data/monsters.json');
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} monsters to ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
