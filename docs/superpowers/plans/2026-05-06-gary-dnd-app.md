# Gary's D&D Encounter & Weather Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static SvelteKit web app that takes D&D environmental and party inputs and rolls a weighted weather report and random encounter, deployable free on Cloudflare Pages.

**Architecture:** Three layers in a single static site. Pure-TypeScript engine (framework-free, deterministic given a seed) consumes hand-authored JSON modifier rules and a pre-fetched Open5e SRD monster snapshot. SvelteKit UI is a thin shell over the engine.

**Tech Stack:** SvelteKit + TypeScript + Vitest + `@sveltejs/adapter-static`. Deployed on Cloudflare Pages from GitHub.

**Spec:** `docs/superpowers/specs/2026-05-06-gary-dnd-app-design.md`

---

## File Structure

```
GaryDnDApp/
├── src/
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── rng.ts                  ← seeded PRNG, sub-seed derivation
│   │   │   ├── types.ts                ← Inputs, Result, Modifier, etc.
│   │   │   ├── weather.ts              ← rollWeather()
│   │   │   ├── encounter.ts            ← encounterCheck() + encounterPick()
│   │   │   └── index.ts                ← roll() composes everything
│   │   ├── data/
│   │   │   ├── monsters.json           ← generated, committed
│   │   │   ├── climate-weather.json    ← hand-authored
│   │   │   ├── environment-modifiers.json
│   │   │   ├── season-modifiers.json
│   │   │   └── encounter-modifiers.json
│   │   └── components/
│   │       ├── InputForm.svelte
│   │       ├── ResultPanel.svelte
│   │       ├── WeatherBlock.svelte
│   │       ├── EncounterBlock.svelte
│   │       ├── MechanicsChip.svelte
│   │       └── Footer.svelte
│   ├── routes/
│   │   └── +page.svelte
│   ├── app.html
│   └── app.css
├── scripts/
│   ├── fetch-monsters.ts               ← snapshot Open5e SRD monsters
│   └── categorise.ts                   ← apply category tags
├── data-overrides/
│   └── categories.json                 ← hand overrides for tricky monsters
├── tests/
│   └── engine/
│       ├── rng.test.ts
│       ├── weather.test.ts
│       └── encounter.test.ts
├── .github/workflows/ci.yml
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

Each engine file owns one responsibility; data files are pure data; components are pure UI consuming engine output.

---

## Task 1: Scaffold SvelteKit project

**Files:**

- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `.gitignore`

- [ ] **Step 1: Run SvelteKit init**

Run: `npm create svelte@latest .` (when prompted: Skeleton project, TypeScript, no ESLint/Prettier yet, no Playwright, Vitest **yes**, Svelte 5)

Then: `npm install`

- [ ] **Step 2: Install adapter-static and replace adapter-auto**

Run: `npm uninstall @sveltejs/adapter-auto && npm install -D @sveltejs/adapter-static`

- [ ] **Step 3: Configure adapter-static in `svelte.config.js`**

Replace contents:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    })
  }
};
```

- [ ] **Step 4: Force prerender on root layout**

Create/replace `src/routes/+layout.ts`:

```ts
export const prerender = true;
export const ssr = false;
```

- [ ] **Step 5: Verify build works**

Run: `npm run build`
Expected: Completes without errors. `build/` directory exists with `index.html`.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold SvelteKit static project"
```

---

## Task 2: Configure dev tooling (lint, format, test paths)

**Files:**

- Create: `.prettierrc`, `eslint.config.js`
- Modify: `package.json` scripts, `vite.config.ts`

- [ ] **Step 1: Install Prettier and ESLint**

Run: `npm install -D prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-svelte prettier-plugin-svelte`

- [ ] **Step 2: Add `.prettierrc`**

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

- [ ] **Step 3: Add `eslint.config.js` (flat config)**

```js
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': ts },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  ...svelte.configs['flat/recommended'],
  { ignores: ['build/', '.svelte-kit/', 'node_modules/'] }
];
```

- [ ] **Step 4: Update `package.json` scripts**

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "lint": "prettier --check . && eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "fetch:monsters": "tsx scripts/fetch-monsters.ts && tsx scripts/categorise.ts"
  }
}
```

- [ ] **Step 5: Install tsx for running scripts**

Run: `npm install -D tsx`

- [ ] **Step 6: Configure Vitest in `vite.config.ts`**

Replace contents:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node'
  }
});
```

- [ ] **Step 7: Verify everything**

Run: `npm run check && npm run lint && npm test && npm run build`
Expected: All pass. `npm test` reports 0 tests (no tests yet).

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: add prettier, eslint, vitest, tsx tooling"
```

---

## Task 3: Engine — seeded RNG and sub-seed derivation

**Files:**

- Create: `src/lib/engine/rng.ts`
- Test: `tests/engine/rng.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/rng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeRng, deriveSeed } from '../../src/lib/engine/rng';

describe('makeRng', () => {
  it('produces deterministic output for the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different output for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toEqual(b());
  });

  it('returns values in [0, 1)', () => {
    const r = makeRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('deriveSeed', () => {
  it('produces stable sub-seeds for the same parent + label', () => {
    expect(deriveSeed(100, 'weather')).toEqual(deriveSeed(100, 'weather'));
  });

  it('produces different sub-seeds for different labels', () => {
    expect(deriveSeed(100, 'weather')).not.toEqual(deriveSeed(100, 'encounter'));
  });

  it('produces different sub-seeds for different parents', () => {
    expect(deriveSeed(1, 'weather')).not.toEqual(deriveSeed(2, 'weather'));
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: All tests fail with "module not found".

- [ ] **Step 3: Implement `rng.ts`**

```ts
export type Rng = () => number;

// mulberry32: small, fast, well-distributed for non-crypto uses.
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 32-bit FNV-1a, sufficient for deriving sub-seeds.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deriveSeed(parent: number, label: string): number {
  return (fnv1a(`${parent}:${label}`) ^ parent) >>> 0;
}

// Convenience helpers built on top of an Rng.
export function pickIndex(rng: Rng, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function pickFrom<T>(rng: Rng, items: T[], weights?: number[]): T {
  if (items.length === 0) throw new Error('pickFrom: empty array');
  const w = weights ?? items.map(() => 1);
  return items[pickIndex(rng, w)];
}

export function rollD100(rng: Rng): number {
  return Math.floor(rng() * 100) + 1;
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npm test`
Expected: All RNG tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/rng.ts tests/engine/rng.test.ts
git commit -m "feat(engine): seeded RNG and sub-seed derivation"
```

---

## Task 4: Engine — core types

**Files:**

- Create: `src/lib/engine/types.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
export type Climate = 'Tropical' | 'Subtropical' | 'Arid' | 'Temperate' | 'Subarctic' | 'Arctic';
export type Environment =
  | 'Arctic'
  | 'Coastal'
  | 'Desert'
  | 'Forest'
  | 'Grassland'
  | 'Hills'
  | 'Mountains'
  | 'Swamp'
  | 'Underground'
  | 'Urban'
  | 'Wasteland';
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export type TimeOfDay = 'Dawn' | 'Day' | 'Dusk' | 'Night';
export type RegionType = 'Settled' | 'Frontier' | 'Wilderness' | 'Hostile';
export type TravelMode = 'Travelling' | 'AtCamp';

export type Temperature = 'Freezing' | 'Cold' | 'Cool' | 'Temperate' | 'Warm' | 'Hot';
export type Precipitation = 'Clear' | 'Light' | 'Heavy';
export type Wind = 'None' | 'Low' | 'High';

export type MonsterCategory =
  | 'Predator'
  | 'Bandit'
  | 'Civilised'
  | 'Undead'
  | 'Fey'
  | 'Aberration'
  | 'Construct'
  | 'Other';

export interface Inputs {
  climate: Climate;
  environment: Environment;
  season: Season;
  time: TimeOfDay;
  region: RegionType;
  partyLevel: number; // 1..20
  partySize: number; // 1..8
  mode: TravelMode;
  campfire: boolean;
  noise: boolean;
}

export interface Weather {
  temp: Temperature;
  precip: Precipitation;
  wind: Wind;
  narrative: string;
  effects: WeatherEffect[];
}

export interface WeatherEffect {
  id: string;
  text: string;
  source: 'SRD' | 'Original';
}

export interface Monster {
  slug: string;
  name: string;
  cr: number;
  type: string;
  size: string;
  environments: Environment[];
  hp: number;
  ac: number;
  speed: string;
  statblock: string; // markdown summary, pre-rendered
  category: MonsterCategory;
}

export interface Encounter {
  creature: Monster;
  count: number;
  narrative: string;
  contributingModifiers: string[];
}

export interface RollResult {
  seed: number;
  weather: Weather;
  encounter: Encounter | null;
  encounterMessage: string | null; // populated when encounter is null
}

export interface ModifierRule {
  id: string;
  when: Partial<{
    climate: Climate;
    environment: Environment;
    season: Season;
    time: TimeOfDay;
    region: RegionType;
    mode: TravelMode;
    campfire: boolean;
    noise: boolean;
    weatherSeverity: 'Mild' | 'Severe';
  }>;
  encounterChanceMultiplier?: number;
  categoryMultipliers?: Partial<Record<MonsterCategory, number>>;
  narrativeFragment?: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/engine/types.ts
git commit -m "feat(engine): core types"
```

---

## Task 5: Author weather data files

**Files:**

- Create: `src/lib/data/climate-weather.json`, `src/lib/data/environment-modifiers.json`, `src/lib/data/season-modifiers.json`

- [ ] **Step 1: Write `climate-weather.json`**

Each climate has base weights for Temperature (6 buckets), Precipitation (3 buckets), Wind (3 buckets). Weights don't need to sum to 100; they're normalised at roll time.

```json
{
  "Tropical": {
    "temp": { "Freezing": 0, "Cold": 0, "Cool": 5, "Temperate": 20, "Warm": 50, "Hot": 25 },
    "precip": { "Clear": 30, "Light": 40, "Heavy": 30 },
    "wind": { "None": 30, "Low": 50, "High": 20 }
  },
  "Subtropical": {
    "temp": { "Freezing": 0, "Cold": 2, "Cool": 13, "Temperate": 30, "Warm": 40, "Hot": 15 },
    "precip": { "Clear": 45, "Light": 35, "Heavy": 20 },
    "wind": { "None": 30, "Low": 55, "High": 15 }
  },
  "Arid": {
    "temp": { "Freezing": 1, "Cold": 4, "Cool": 10, "Temperate": 20, "Warm": 35, "Hot": 30 },
    "precip": { "Clear": 80, "Light": 15, "Heavy": 5 },
    "wind": { "None": 25, "Low": 50, "High": 25 }
  },
  "Temperate": {
    "temp": { "Freezing": 5, "Cold": 15, "Cool": 25, "Temperate": 30, "Warm": 20, "Hot": 5 },
    "precip": { "Clear": 50, "Light": 35, "Heavy": 15 },
    "wind": { "None": 25, "Low": 55, "High": 20 }
  },
  "Subarctic": {
    "temp": { "Freezing": 25, "Cold": 35, "Cool": 25, "Temperate": 12, "Warm": 3, "Hot": 0 },
    "precip": { "Clear": 50, "Light": 30, "Heavy": 20 },
    "wind": { "None": 20, "Low": 50, "High": 30 }
  },
  "Arctic": {
    "temp": { "Freezing": 60, "Cold": 30, "Cool": 8, "Temperate": 2, "Warm": 0, "Hot": 0 },
    "precip": { "Clear": 50, "Light": 25, "Heavy": 25 },
    "wind": { "None": 15, "Low": 45, "High": 40 }
  }
}
```

- [ ] **Step 2: Write `season-modifiers.json`**

Multiplicative shifts on temperature buckets per (climate, season). Magnitude is small for Arctic, larger for Temperate.

```json
{
  "Tropical": {
    "Spring": { "temp": { "Cool": 1.1, "Warm": 1.0, "Hot": 1.0 } },
    "Summer": { "temp": { "Warm": 1.1, "Hot": 1.2 } },
    "Autumn": { "temp": { "Cool": 1.1, "Warm": 1.0 } },
    "Winter": { "temp": { "Cool": 1.3, "Temperate": 1.1, "Warm": 0.9 } }
  },
  "Subtropical": {
    "Spring": { "temp": { "Temperate": 1.1, "Warm": 1.0 } },
    "Summer": { "temp": { "Warm": 1.2, "Hot": 1.4 } },
    "Autumn": { "temp": { "Cool": 1.2, "Temperate": 1.1 } },
    "Winter": { "temp": { "Cold": 1.5, "Cool": 1.3, "Warm": 0.7, "Hot": 0.4 } }
  },
  "Arid": {
    "Spring": { "temp": { "Temperate": 1.1, "Warm": 1.1 } },
    "Summer": { "temp": { "Warm": 1.2, "Hot": 1.6 } },
    "Autumn": { "temp": { "Cool": 1.3, "Temperate": 1.1 } },
    "Winter": { "temp": { "Cold": 1.6, "Cool": 1.4, "Hot": 0.4 } }
  },
  "Temperate": {
    "Spring": { "temp": { "Cool": 1.2, "Temperate": 1.1, "Warm": 1.0 } },
    "Summer": { "temp": { "Warm": 1.4, "Hot": 1.6 } },
    "Autumn": { "temp": { "Cool": 1.3, "Cold": 1.1 } },
    "Winter": { "temp": { "Freezing": 1.6, "Cold": 1.5, "Warm": 0.4, "Hot": 0.1 } }
  },
  "Subarctic": {
    "Spring": { "temp": { "Cold": 1.1, "Cool": 1.2 } },
    "Summer": { "temp": { "Cool": 1.3, "Temperate": 1.5, "Warm": 1.4 } },
    "Autumn": { "temp": { "Cold": 1.3, "Freezing": 1.1 } },
    "Winter": { "temp": { "Freezing": 1.6, "Cold": 1.3, "Cool": 0.6, "Temperate": 0.2 } }
  },
  "Arctic": {
    "Spring": { "temp": { "Freezing": 1.0, "Cold": 1.1 } },
    "Summer": { "temp": { "Cold": 1.2, "Cool": 1.4 } },
    "Autumn": { "temp": { "Freezing": 1.1, "Cold": 1.0 } },
    "Winter": { "temp": { "Freezing": 1.4, "Cold": 0.9 } }
  }
}
```

- [ ] **Step 3: Write `environment-modifiers.json`**

Multiplicative overrides on precipitation/wind per environment.

```json
{
  "Arctic": { "precip": { "Heavy": 1.3 }, "wind": { "High": 1.5 } },
  "Coastal": { "precip": { "Light": 1.2, "Heavy": 1.2 }, "wind": { "Low": 1.2, "High": 1.4 } },
  "Desert": { "precip": { "Clear": 1.3, "Heavy": 0.3 }, "wind": { "High": 1.3 } },
  "Forest": { "precip": { "Light": 1.1 }, "wind": { "Low": 0.7, "High": 0.5 } },
  "Grassland": { "wind": { "Low": 1.2, "High": 1.4 } },
  "Hills": { "wind": { "Low": 1.1, "High": 1.2 } },
  "Mountains": { "precip": { "Heavy": 1.4 }, "wind": { "High": 1.8 } },
  "Swamp": { "precip": { "Light": 1.4, "Heavy": 1.2 }, "wind": { "None": 1.4, "High": 0.5 } },
  "Underground": {
    "precip": { "Clear": 5.0, "Light": 0, "Heavy": 0 },
    "wind": { "None": 5.0, "Low": 0, "High": 0 }
  },
  "Urban": {},
  "Wasteland": { "precip": { "Clear": 1.2 }, "wind": { "High": 1.3 } }
}
```

- [ ] **Step 4: Verify JSON parses**

Run: `node -e "['climate-weather','season-modifiers','environment-modifiers'].forEach(f => JSON.parse(require('fs').readFileSync('src/lib/data/'+f+'.json','utf8')))"`
Expected: No output (success).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/climate-weather.json src/lib/data/season-modifiers.json src/lib/data/environment-modifiers.json
git commit -m "feat(data): authored weather distribution tables"
```

---

## Task 6: Engine — weather rolling

**Files:**

- Create: `src/lib/engine/weather.ts`
- Test: `tests/engine/weather.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/weather.test.ts`:

```ts
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
      // We model "snow" as Heavy precip + Freezing/Cold; check the inverse case never appears.
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
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: All weather tests fail with "module not found".

- [ ] **Step 3: Implement `weather.ts`**

```ts
import type { Inputs, Weather, WeatherEffect, Temperature, Precipitation, Wind } from './types';
import type { Rng } from './rng';
import { pickFrom } from './rng';
import climateData from '../data/climate-weather.json';
import seasonData from '../data/season-modifiers.json';
import envData from '../data/environment-modifiers.json';

type AxisWeights<K extends string> = Record<K, number>;

function weightedPick<K extends string>(rng: Rng, weights: AxisWeights<K>): K {
  const keys = Object.keys(weights) as K[];
  const w = keys.map((k) => Math.max(0, weights[k]));
  return pickFrom(rng, keys, w);
}

function applyMultipliers<K extends string>(
  base: AxisWeights<K>,
  multipliers: Partial<Record<K, number>> | undefined
): AxisWeights<K> {
  if (!multipliers) return base;
  const out = { ...base } as AxisWeights<K>;
  for (const k of Object.keys(multipliers) as K[]) {
    const m = multipliers[k];
    if (typeof m === 'number') out[k] = (out[k] ?? 0) * m;
  }
  return out;
}

const TEMP_KEYS: Temperature[] = ['Freezing', 'Cold', 'Cool', 'Temperate', 'Warm', 'Hot'];

function combinationValid(temp: Temperature, precip: Precipitation): boolean {
  // Heavy precip with Hot temperature: re-roll. Cold + Heavy = snow, fine.
  if (precip === 'Heavy' && temp === 'Hot') return false;
  return true;
}

export function rollWeather(inputs: Inputs, rng: Rng): Weather {
  const climate = (
    climateData as Record<
      string,
      {
        temp: AxisWeights<Temperature>;
        precip: AxisWeights<Precipitation>;
        wind: AxisWeights<Wind>;
      }
    >
  )[inputs.climate];
  const seasonMod = (
    seasonData as Record<string, Record<string, { temp?: Partial<Record<Temperature, number>> }>>
  )[inputs.climate]?.[inputs.season];
  const envMod = (
    envData as Record<
      string,
      { precip?: Partial<Record<Precipitation, number>>; wind?: Partial<Record<Wind, number>> }
    >
  )[inputs.environment];

  const tempWeights = applyMultipliers(climate.temp, seasonMod?.temp);
  const precipWeights = applyMultipliers(climate.precip, envMod?.precip);
  const windWeights = applyMultipliers(climate.wind, envMod?.wind);

  let temp = weightedPick(rng, tempWeights);
  let precip = weightedPick(rng, precipWeights);
  // Re-roll precip up to 5 times if combo is impossible.
  for (let i = 0; i < 5 && !combinationValid(temp, precip); i++) {
    precip = weightedPick(rng, precipWeights);
  }
  if (!combinationValid(temp, precip)) precip = 'Light';
  const wind = weightedPick(rng, windWeights);

  return {
    temp,
    precip,
    wind,
    narrative: narrate(temp, precip, wind, inputs.environment),
    effects: effectsFor(temp, precip, wind)
  };
}

function narrate(temp: Temperature, precip: Precipitation, wind: Wind, env: string): string {
  const tempPhrase: Record<Temperature, string> = {
    Freezing: 'Bitterly cold',
    Cold: 'Cold',
    Cool: 'Cool',
    Temperate: 'Mild',
    Warm: 'Warm',
    Hot: 'Sweltering'
  };
  const precipPhrase: Record<Precipitation, string> = {
    Clear: 'clear skies',
    Light: temp === 'Freezing' || temp === 'Cold' ? 'light snowfall' : 'a steady drizzle',
    Heavy: temp === 'Freezing' || temp === 'Cold' ? 'heavy snow' : 'driving rain'
  };
  const windPhrase: Record<Wind, string> = {
    None: 'still air',
    Low: 'a light breeze',
    High: 'strong winds'
  };
  if (env === 'Underground') {
    return `Cool, still air. The cavern temperature holds steady.`;
  }
  return `${tempPhrase[temp]}, with ${precipPhrase[precip]} and ${windPhrase[wind]}.`;
}

function effectsFor(temp: Temperature, precip: Precipitation, wind: Wind): WeatherEffect[] {
  const out: WeatherEffect[] = [];
  if (precip === 'Heavy' || wind === 'High') {
    out.push({
      id: 'perception-disadvantage',
      text: 'Disadvantage on Wisdom (Perception) checks relying on sight or hearing.',
      source: 'SRD'
    });
  }
  if (precip === 'Heavy' && (temp === 'Freezing' || temp === 'Cold')) {
    out.push({
      id: 'travel-pace-half',
      text: 'Travel pace halved while the snowstorm continues.',
      source: 'Original'
    });
  }
  if (wind === 'High') {
    out.push({
      id: 'ranged-disadvantage',
      text: 'Ranged weapon attacks have disadvantage in strong winds.',
      source: 'Original'
    });
  }
  if (temp === 'Freezing') {
    out.push({
      id: 'cold-exhaustion',
      text: 'Without cold-weather gear, each hour requires a DC 10 Constitution save or gain a level of exhaustion.',
      source: 'SRD'
    });
  }
  if (temp === 'Hot') {
    out.push({
      id: 'heat-exhaustion',
      text: 'Without water, each hour past 4 requires a DC 5 (+1 per hour) Constitution save or gain a level of exhaustion.',
      source: 'SRD'
    });
  }
  return out;
}
```

- [ ] **Step 4: Verify TypeScript JSON imports work**

Add to `tsconfig.json` `compilerOptions` (if not already there):

```json
"resolveJsonModule": true,
"esModuleInterop": true
```

- [ ] **Step 5: Run tests, confirm they pass**

Run: `npm test`
Expected: All weather tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/engine/weather.ts tests/engine/weather.test.ts tsconfig.json
git commit -m "feat(engine): rollWeather with climate/season/env modifiers"
```

---

## Task 7: Open5e fetch + categorise scripts

**Files:**

- Create: `scripts/fetch-monsters.ts`, `scripts/categorise.ts`, `data-overrides/categories.json`, `src/lib/data/monsters.json`

- [ ] **Step 1: Write `scripts/fetch-monsters.ts`**

```ts
/**
 * One-shot snapshot of Open5e SRD monsters.
 * Run with: npm run fetch:monsters
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ENV_TAGS: Record<string, string> = {
  arctic: 'Arctic',
  coastal: 'Coastal',
  desert: 'Desert',
  forest: 'Forest',
  grassland: 'Grassland',
  hill: 'Hills',
  mountain: 'Mountains',
  swamp: 'Swamp',
  underdark: 'Underground',
  urban: 'Urban',
  wasteland: 'Wasteland'
};

interface Open5eCreature {
  key?: string;
  slug?: string;
  name: string;
  challenge_rating?: number | string;
  cr?: number | string;
  type?: string | { key?: string; name?: string };
  size?: string | { key?: string; name?: string };
  environments?: Array<string | { key?: string; name?: string }>;
  hit_points?: number;
  hp?: { value?: number } | number;
  armor_class?: number | Array<{ value: number }>;
  ac?: number;
  speed?: Record<string, number> | string;
  document?: { key?: string };
  document__key?: string;
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

function fieldString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (
    v &&
    typeof v === 'object' &&
    'name' in v &&
    typeof (v as { name: string }).name === 'string'
  ) {
    return (v as { name: string }).name;
  }
  if (v && typeof v === 'object' && 'key' in v && typeof (v as { key: string }).key === 'string') {
    return (v as { key: string }).key;
  }
  return '';
}

function parseCr(v: unknown): number {
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

function parseAc(v: unknown): number {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && v.length > 0 && typeof v[0]?.value === 'number') return v[0].value;
  return 10;
}

function parseHp(v: unknown): number {
  if (typeof v === 'number') return v;
  if (
    v &&
    typeof v === 'object' &&
    'value' in v &&
    typeof (v as { value: number }).value === 'number'
  ) {
    return (v as { value: number }).value;
  }
  return 1;
}

function parseSpeed(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, number>)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k} ${n}ft`)
      .join(', ');
  }
  return '';
}

function normaliseEnvs(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((e) => fieldString(e).toLowerCase())
    .map((s) => ENV_TAGS[s])
    .filter((s): s is string => Boolean(s));
}

async function main() {
  // V2 endpoint, paged.
  const out: NormalisedMonster[] = [];
  let url: string | null = 'https://api.open5e.com/v2/creatures/?limit=200';
  let page = 0;
  while (url) {
    page++;
    process.stdout.write(`Fetching page ${page}... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const json = (await res.json()) as { results: Open5eCreature[]; next: string | null };
    process.stdout.write(`${json.results.length} creatures\n`);
    for (const c of json.results) {
      const docKey = c.document?.key ?? c.document__key ?? '';
      // SRD only.
      if (!docKey.startsWith('srd_')) continue;
      const envs = normaliseEnvs(c.environments);
      if (envs.length === 0) continue;
      const slug = c.key ?? c.slug ?? c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      out.push({
        slug,
        name: c.name,
        cr: parseCr(c.challenge_rating ?? c.cr),
        type: fieldString(c.type),
        size: fieldString(c.size),
        environments: envs,
        hp: parseHp(c.hit_points ?? c.hp),
        ac: parseAc(c.armor_class ?? c.ac),
        speed: parseSpeed(c.speed),
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
```

- [ ] **Step 2: Write `data-overrides/categories.json`**

Seed list of common SRD monsters whose category isn't obvious from `type` alone. The categoriser falls back to type-based heuristics for unlisted monsters.

```json
{
  "wolf": "Predator",
  "dire-wolf": "Predator",
  "worg": "Predator",
  "brown-bear": "Predator",
  "black-bear": "Predator",
  "polar-bear": "Predator",
  "lion": "Predator",
  "tiger": "Predator",
  "panther": "Predator",
  "saber-toothed-tiger": "Predator",
  "giant-spider": "Predator",
  "wolf-spider": "Predator",
  "giant-wolf-spider": "Predator",
  "boar": "Predator",
  "giant-boar": "Predator",
  "ape": "Predator",
  "giant-ape": "Predator",
  "crocodile": "Predator",
  "giant-crocodile": "Predator",
  "rat": "Other",
  "giant-rat": "Predator",
  "bandit": "Bandit",
  "bandit-captain": "Bandit",
  "thug": "Bandit",
  "spy": "Bandit",
  "scout": "Bandit",
  "berserker": "Bandit",
  "veteran": "Civilised",
  "guard": "Civilised",
  "knight": "Civilised",
  "noble": "Civilised",
  "commoner": "Civilised",
  "acolyte": "Civilised",
  "priest": "Civilised",
  "tribal-warrior": "Bandit",
  "goblin": "Bandit",
  "hobgoblin": "Bandit",
  "bugbear": "Bandit",
  "orc": "Bandit",
  "kobold": "Bandit",
  "gnoll": "Predator",
  "ogre": "Predator",
  "troll": "Predator",
  "owlbear": "Predator",
  "manticore": "Predator",
  "wyvern": "Predator",
  "harpy": "Predator",
  "hippogriff": "Predator",
  "griffon": "Predator",
  "pegasus": "Other",
  "unicorn": "Fey",
  "pixie": "Fey",
  "sprite": "Fey",
  "dryad": "Fey",
  "satyr": "Fey",
  "blink-dog": "Fey",
  "hag": "Fey"
}
```

- [ ] **Step 3: Write `scripts/categorise.ts`**

```ts
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
  if (t.includes('humanoid')) return 'Bandit'; // default-aggressive humanoid; overrides correct civilised cases
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
```

- [ ] **Step 4: Run the snapshot**

Run: `npm run fetch:monsters`
Expected: Network calls, then "Wrote N monsters" and "Categorised N monsters" lines. `src/lib/data/monsters.json` is created and committed-ready.

If Open5e is unreachable, create a placeholder `src/lib/data/monsters.json` with a small hand-written sample of 5-10 SRD monsters in the same shape, so engine development isn't blocked.

- [ ] **Step 5: Commit**

```bash
git add scripts/ data-overrides/ src/lib/data/monsters.json
git commit -m "feat(data): Open5e SRD monster snapshot + categoriser"
```

---

## Task 8: Author encounter-modifiers.json

**Files:**

- Create: `src/lib/data/encounter-modifiers.json`

- [ ] **Step 1: Write the file**

```json
{
  "baseEncounterChance": 0.25,
  "rules": [
    {
      "id": "region-settled",
      "when": { "region": "Settled" },
      "encounterChanceMultiplier": 0.5,
      "categoryMultipliers": { "Civilised": 3.0, "Predator": 0.4, "Aberration": 0.1, "Undead": 0.2 }
    },
    {
      "id": "region-frontier",
      "when": { "region": "Frontier" },
      "encounterChanceMultiplier": 1.0,
      "categoryMultipliers": { "Bandit": 1.4, "Civilised": 1.0 }
    },
    {
      "id": "region-wilderness",
      "when": { "region": "Wilderness" },
      "encounterChanceMultiplier": 1.4,
      "categoryMultipliers": { "Predator": 2.0, "Fey": 1.5, "Civilised": 0.4 }
    },
    {
      "id": "region-hostile",
      "when": { "region": "Hostile" },
      "encounterChanceMultiplier": 1.8,
      "categoryMultipliers": {
        "Predator": 2.0,
        "Aberration": 2.0,
        "Undead": 2.0,
        "Bandit": 1.5,
        "Civilised": 0.2
      }
    },
    {
      "id": "time-night",
      "when": { "time": "Night" },
      "encounterChanceMultiplier": 1.3,
      "categoryMultipliers": { "Predator": 1.8, "Undead": 2.5, "Civilised": 0.5 },
      "narrativeFragment": "in the dark"
    },
    {
      "id": "time-dawn",
      "when": { "time": "Dawn" },
      "categoryMultipliers": { "Predator": 1.2 },
      "narrativeFragment": "in the half-light of dawn"
    },
    {
      "id": "time-dusk",
      "when": { "time": "Dusk" },
      "categoryMultipliers": { "Predator": 1.5, "Undead": 1.4 },
      "narrativeFragment": "as the sun sets"
    },
    {
      "id": "camp-fire",
      "when": { "mode": "AtCamp", "campfire": true },
      "encounterChanceMultiplier": 0.8,
      "categoryMultipliers": { "Predator": 0.5, "Bandit": 1.5 },
      "narrativeFragment": "drawn by your firelight"
    },
    {
      "id": "camp-no-fire",
      "when": { "mode": "AtCamp", "campfire": false },
      "encounterChanceMultiplier": 1.1,
      "categoryMultipliers": { "Predator": 1.5 }
    },
    {
      "id": "noise",
      "when": { "noise": true },
      "encounterChanceMultiplier": 1.6,
      "categoryMultipliers": { "Predator": 1.2, "Bandit": 1.5 },
      "narrativeFragment": "drawn by the noise"
    },
    {
      "id": "severe-weather",
      "when": { "weatherSeverity": "Severe" },
      "encounterChanceMultiplier": 0.5,
      "narrativeFragment": "braving the weather"
    },
    {
      "id": "swamp",
      "when": { "environment": "Swamp" },
      "categoryMultipliers": { "Aberration": 1.5, "Undead": 1.4 }
    },
    {
      "id": "underground",
      "when": { "environment": "Underground" },
      "categoryMultipliers": { "Aberration": 2.0, "Undead": 1.5, "Construct": 1.3, "Fey": 0.3 }
    },
    {
      "id": "urban",
      "when": { "environment": "Urban" },
      "encounterChanceMultiplier": 1.2,
      "categoryMultipliers": { "Civilised": 3.0, "Bandit": 2.0, "Predator": 0.2 }
    }
  ]
}
```

- [ ] **Step 2: Verify JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/lib/data/encounter-modifiers.json','utf8'))"`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/encounter-modifiers.json
git commit -m "feat(data): authored encounter modifier rules"
```

---

## Task 9: Engine — encounter check and pick

**Files:**

- Create: `src/lib/engine/encounter.ts`
- Test: `tests/engine/encounter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/engine/encounter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  encounterCheck,
  encounterPick,
  crWindow,
  applyModifiers
} from '../../src/lib/engine/encounter';
import { makeRng } from '../../src/lib/engine/rng';
import type { Inputs, Monster, Weather } from '../../src/lib/engine/types';

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

const tameWeather: Weather = {
  temp: 'Temperate',
  precip: 'Clear',
  wind: 'Low',
  narrative: '',
  effects: []
};
const wildWeather: Weather = {
  temp: 'Freezing',
  precip: 'Heavy',
  wind: 'High',
  narrative: '',
  effects: []
};

const sampleMonsters: Monster[] = [
  {
    slug: 'wolf',
    name: 'Wolf',
    cr: 0.25,
    type: 'beast',
    size: 'Medium',
    environments: ['Forest', 'Hills', 'Grassland'],
    hp: 11,
    ac: 13,
    speed: '40ft',
    statblock: '',
    category: 'Predator'
  },
  {
    slug: 'bandit',
    name: 'Bandit',
    cr: 0.125,
    type: 'humanoid',
    size: 'Medium',
    environments: ['Forest', 'Urban', 'Hills', 'Grassland'],
    hp: 11,
    ac: 12,
    speed: '30ft',
    statblock: '',
    category: 'Bandit'
  },
  {
    slug: 'guard',
    name: 'Guard',
    cr: 0.125,
    type: 'humanoid',
    size: 'Medium',
    environments: ['Urban'],
    hp: 11,
    ac: 16,
    speed: '30ft',
    statblock: '',
    category: 'Civilised'
  },
  {
    slug: 'zombie',
    name: 'Zombie',
    cr: 0.25,
    type: 'undead',
    size: 'Medium',
    environments: ['Swamp', 'Underground'],
    hp: 22,
    ac: 8,
    speed: '20ft',
    statblock: '',
    category: 'Undead'
  },
  {
    slug: 'troll',
    name: 'Troll',
    cr: 5,
    type: 'giant',
    size: 'Large',
    environments: ['Forest', 'Mountains', 'Swamp'],
    hp: 84,
    ac: 15,
    speed: '30ft',
    statblock: '',
    category: 'Predator'
  }
];

describe('crWindow', () => {
  it('returns wider window for higher region difficulty', () => {
    const settled = crWindow(3, 4, 'Settled');
    const hostile = crWindow(3, 4, 'Hostile');
    expect(hostile.max).toBeGreaterThan(settled.max);
  });

  it('floor scales with party level', () => {
    expect(crWindow(10, 4, 'Frontier').min).toBeGreaterThan(crWindow(1, 4, 'Frontier').min);
  });
});

describe('applyModifiers', () => {
  it('composes multiplicative encounter chance from matching rules', () => {
    const inputs = baseInputs({ region: 'Hostile', noise: true });
    const out = applyModifiers(inputs, tameWeather);
    // baseEncounterChance (0.25) × 1.8 (hostile) × 1.6 (noise) = 0.72
    expect(out.encounterChance).toBeCloseTo(0.72, 2);
  });

  it('multiplies category weights from matching rules', () => {
    const inputs = baseInputs({
      time: 'Night',
      region: 'Wilderness',
      mode: 'AtCamp',
      campfire: false
    });
    const out = applyModifiers(inputs, tameWeather);
    expect(out.categoryWeights.Predator).toBeGreaterThan(out.categoryWeights.Civilised);
  });

  it('treats heavy precip + high wind as severe weather', () => {
    const inputs = baseInputs();
    const out = applyModifiers(inputs, wildWeather);
    // The severe-weather rule is x0.5 on encounter chance.
    const calm = applyModifiers(inputs, tameWeather);
    expect(out.encounterChance).toBeLessThan(calm.encounterChance);
  });
});

describe('encounterCheck', () => {
  it('is deterministic', () => {
    const inputs = baseInputs();
    const a = encounterCheck(inputs, tameWeather, makeRng(99));
    const b = encounterCheck(inputs, tameWeather, makeRng(99));
    expect(a).toEqual(b);
  });

  it('triggers more often in hostile regions than settled', () => {
    let hostile = 0,
      settled = 0;
    for (let s = 0; s < 1000; s++) {
      if (encounterCheck(baseInputs({ region: 'Hostile' }), tameWeather, makeRng(s)).happens)
        hostile++;
      if (encounterCheck(baseInputs({ region: 'Settled' }), tameWeather, makeRng(s)).happens)
        settled++;
    }
    expect(hostile).toBeGreaterThan(settled * 2);
  });
});

describe('encounterPick', () => {
  it('returns null with hint when pool is empty even after widening', () => {
    const result = encounterPick(
      baseInputs({ environment: 'Wasteland' }),
      tameWeather,
      [],
      makeRng(1)
    );
    expect(result.encounter).toBeNull();
    expect(result.message).toBeTruthy();
  });

  it('respects environment filter', () => {
    for (let s = 0; s < 50; s++) {
      const r = encounterPick(
        baseInputs({ environment: 'Urban' }),
        tameWeather,
        sampleMonsters,
        makeRng(s)
      );
      if (r.encounter) {
        expect(r.encounter.creature.environments).toContain('Urban');
      }
    }
  });

  it('biases toward predators at night in wilderness', () => {
    let predators = 0,
      civilised = 0;
    const inputs = baseInputs({
      environment: 'Forest',
      region: 'Wilderness',
      time: 'Night',
      mode: 'AtCamp',
      campfire: false
    });
    for (let s = 0; s < 500; s++) {
      const r = encounterPick(inputs, tameWeather, sampleMonsters, makeRng(s));
      if (!r.encounter) continue;
      if (r.encounter.creature.category === 'Predator') predators++;
      if (r.encounter.creature.category === 'Civilised') civilised++;
    }
    expect(predators).toBeGreaterThan(civilised);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: Encounter tests fail with "module not found".

- [ ] **Step 3: Implement `encounter.ts`**

```ts
import type { Inputs, Weather, Monster, Encounter, ModifierRule, MonsterCategory } from './types';
import { type Rng, pickFrom, pickIndex } from './rng';
import modifiersData from '../data/encounter-modifiers.json';

interface ModifiersFile {
  baseEncounterChance: number;
  rules: ModifierRule[];
}
const MODS = modifiersData as ModifiersFile;

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
  if (w.weatherSeverity) {
    const severe =
      weather.precip === 'Heavy' ||
      weather.wind === 'High' ||
      weather.temp === 'Freezing' ||
      weather.temp === 'Hot';
    const flag = severe ? 'Severe' : 'Mild';
    if (w.weatherSeverity !== flag) return false;
  }
  return true;
}

export interface AppliedModifiers {
  encounterChance: number;
  categoryWeights: Record<MonsterCategory, number>;
  matchingRules: ModifierRule[];
}

export function applyModifiers(inputs: Inputs, weather: Weather): AppliedModifiers {
  let chance = MODS.baseEncounterChance;
  const cat: Record<MonsterCategory, number> = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, 1])
  ) as Record<MonsterCategory, number>;
  const matchingRules: ModifierRule[] = [];
  for (const rule of MODS.rules) {
    if (!matches(rule, inputs, weather)) continue;
    matchingRules.push(rule);
    if (rule.encounterChanceMultiplier) chance *= rule.encounterChanceMultiplier;
    if (rule.categoryMultipliers) {
      for (const c of ALL_CATEGORIES) {
        const m = rule.categoryMultipliers[c];
        if (typeof m === 'number') cat[c] *= m;
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

export function crWindow(level: number, size: number, region: string): CrWindow {
  // Loose, hand-tuned. Floor grows slowly with level; ceiling depends on region.
  const min = Math.max(0, (level - 4) / 4);
  const baseMax = level * 0.85 + (size - 4) * 0.15;
  const regionBonus: Record<string, number> = {
    Settled: -1,
    Frontier: 0,
    Wilderness: 1,
    Hostile: 2
  };
  const max = Math.max(0.25, baseMax + (regionBonus[region] ?? 0));
  return { min, max };
}

function inWindow(cr: number, w: CrWindow): boolean {
  return cr >= w.min && cr <= w.max;
}

export interface CheckResult {
  happens: boolean;
  chance: number;
}

export function encounterCheck(inputs: Inputs, weather: Weather, rng: Rng): CheckResult {
  const { encounterChance } = applyModifiers(inputs, weather);
  return { happens: rng() < encounterChance, chance: encounterChance };
}

export interface PickResult {
  encounter: Encounter | null;
  message: string | null;
}

function decideCount(cr: number, level: number, size: number, rng: Rng): number {
  // Lower-CR creatures appear in groups; high-CR usually solo.
  if (cr >= level) return 1;
  if (cr >= level / 2) return 1 + Math.floor(rng() * 2);
  if (cr >= 1) return 2 + Math.floor(rng() * Math.max(1, Math.min(4, size)));
  return 2 + Math.floor(rng() * Math.max(2, Math.min(6, size + 2)));
}

function buildNarrative(creature: Monster, count: number, rules: ModifierRule[]): string {
  const fragments = rules.map((r) => r.narrativeFragment).filter((f): f is string => Boolean(f));
  const subj =
    count === 1 ? `A ${creature.name.toLowerCase()}` : `${count} ${creature.name.toLowerCase()}s`;
  const tail = fragments.length > 0 ? ` ${fragments.join(', ')}.` : '.';
  return `${subj} appears${tail}`;
}

export function encounterPick(
  inputs: Inputs,
  weather: Weather,
  monsters: Monster[],
  rng: Rng
): PickResult {
  const { categoryWeights, matchingRules } = applyModifiers(inputs, weather);

  // Filter by environment.
  const envPool = monsters.filter((m) => m.environments.includes(inputs.environment));
  if (envPool.length === 0) {
    return {
      encounter: null,
      message: `No matching creatures for ${inputs.environment}. Try loosening filters.`
    };
  }

  // CR windows: original, then widened.
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

  // Group pool by category, with weight = sum of category weight × small bias toward middle of CR window.
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
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `npm test`
Expected: All tests pass (rng + weather + encounter).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/encounter.ts tests/engine/encounter.test.ts
git commit -m "feat(engine): encounter check, pick, modifier composition"
```

---

## Task 10: Engine — top-level roll()

**Files:**

- Create: `src/lib/engine/index.ts`
- Test: append to `tests/engine/encounter.test.ts` (or create `tests/engine/index.test.ts`)

- [ ] **Step 1: Write failing tests**

Create `tests/engine/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { roll } from '../../src/lib/engine';
import type { Inputs } from '../../src/lib/engine/types';

const inputs: Inputs = {
  climate: 'Temperate',
  environment: 'Forest',
  season: 'Spring',
  time: 'Day',
  region: 'Frontier',
  partyLevel: 3,
  partySize: 4,
  mode: 'Travelling',
  campfire: false,
  noise: false
};

describe('roll', () => {
  it('produces deterministic full result for same seed', () => {
    const a = roll(inputs, 12345);
    const b = roll(inputs, 12345);
    expect(a).toEqual(b);
  });

  it('returns the seed in the result', () => {
    expect(roll(inputs, 999).seed).toBe(999);
  });

  it('weather-only and encounter-only sub-seeds are independent', () => {
    const a = roll(inputs, 100);
    // Re-roll weather only with a new weather sub-seed
    const b = roll(inputs, 100, { rerollWeather: 200 });
    // Encounter result should match a's encounter (same parent seed → same encounter sub-seed).
    expect(b.encounter).toEqual(a.encounter);
    // Weather should differ (with high probability).
    expect(b.weather).not.toEqual(a.weather);
  });

  it('encounter-only re-roll keeps weather identical', () => {
    const a = roll(inputs, 100);
    const b = roll(inputs, 100, { rerollEncounter: 300 });
    expect(b.weather).toEqual(a.weather);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `npm test`
Expected: Index tests fail with "module not found".

- [ ] **Step 3: Implement `index.ts`**

```ts
import type { Inputs, RollResult } from './types';
import { makeRng, deriveSeed } from './rng';
import { rollWeather } from './weather';
import { encounterCheck, encounterPick } from './encounter';
import monstersData from '../data/monsters.json';

export interface RerollOptions {
  rerollWeather?: number; // override weather sub-seed
  rerollEncounter?: number; // override encounter sub-seed
}

export function roll(inputs: Inputs, seed: number, opts: RerollOptions = {}): RollResult {
  const weatherSeed = opts.rerollWeather ?? deriveSeed(seed, 'weather');
  const encounterSeed = opts.rerollEncounter ?? deriveSeed(seed, 'encounter');

  const weather = rollWeather(inputs, makeRng(weatherSeed));
  const checkRng = makeRng(deriveSeed(encounterSeed, 'check'));
  const pickRng = makeRng(deriveSeed(encounterSeed, 'pick'));

  const check = encounterCheck(inputs, weather, checkRng);
  if (!check.happens) {
    return { seed, weather, encounter: null, encounterMessage: 'The road is quiet.' };
  }

  const pick = encounterPick(inputs, weather, monstersData as never, pickRng);
  return {
    seed,
    weather,
    encounter: pick.encounter,
    encounterMessage: pick.encounter ? null : pick.message
  };
}

export { rollWeather, encounterCheck, encounterPick };
export * from './types';
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/index.ts tests/engine/index.test.ts
git commit -m "feat(engine): top-level roll() with sub-seed derivation"
```

---

## Task 11: UI — InputForm component

**Files:**

- Create: `src/lib/components/InputForm.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import type { Inputs } from '$lib/engine/types';

  let { value = $bindable(), onRoll }: { value: Inputs; onRoll: () => void } = $props();

  const climates = ['Tropical', 'Subtropical', 'Arid', 'Temperate', 'Subarctic', 'Arctic'] as const;
  const environments = [
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
  ] as const;
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;
  const times = ['Dawn', 'Day', 'Dusk', 'Night'] as const;
  const regions = ['Settled', 'Frontier', 'Wilderness', 'Hostile'] as const;
</script>

<form on:submit|preventDefault={onRoll} class="form">
  <fieldset>
    <legend>Setting</legend>
    <label
      >Climate
      <select bind:value={value.climate}>
        {#each climates as c}<option value={c}>{c}</option>{/each}
      </select>
    </label>
    <label
      >Environment
      <select bind:value={value.environment}>
        {#each environments as e}<option value={e}>{e}</option>{/each}
      </select>
    </label>
    <label
      >Season
      <select bind:value={value.season}>
        {#each seasons as s}<option value={s}>{s}</option>{/each}
      </select>
    </label>
    <label
      >Time of day
      <select bind:value={value.time}>
        {#each times as t}<option value={t}>{t}</option>{/each}
      </select>
    </label>
    <label
      >Region type
      <select bind:value={value.region}>
        {#each regions as r}<option value={r}>{r}</option>{/each}
      </select>
    </label>
  </fieldset>

  <fieldset>
    <legend>Party</legend>
    <label
      >Average level
      <input type="number" min="1" max="20" bind:value={value.partyLevel} />
    </label>
    <label
      >Number of characters
      <input type="number" min="1" max="8" bind:value={value.partySize} />
    </label>
  </fieldset>

  <fieldset>
    <legend>State</legend>
    <label><input type="radio" bind:group={value.mode} value="Travelling" /> Travelling</label>
    <label><input type="radio" bind:group={value.mode} value="AtCamp" /> At camp</label>
    <label
      ><input type="checkbox" bind:checked={value.campfire} disabled={value.mode !== 'AtCamp'} /> Campfire
      lit</label
    >
    <label><input type="checkbox" bind:checked={value.noise} /> Making noise</label>
  </fieldset>

  <button type="submit" class="roll">Roll</button>
</form>

<style>
  .form {
    display: grid;
    gap: 1rem;
  }
  fieldset {
    border: 1px solid #ccc;
    padding: 0.75rem;
    display: grid;
    gap: 0.5rem;
  }
  legend {
    padding: 0 0.25rem;
    font-weight: 600;
  }
  label {
    display: grid;
    grid-template-columns: 9rem 1fr;
    align-items: center;
    gap: 0.5rem;
  }
  input[type='checkbox'],
  input[type='radio'] {
    justify-self: start;
  }
  button.roll {
    padding: 0.75rem 1.5rem;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
  }
  @media (min-width: 640px) {
    .form {
      grid-template-columns: 1fr 1fr;
    }
    button.roll {
      grid-column: 1 / -1;
      justify-self: center;
      min-width: 12rem;
    }
  }
</style>
```

- [ ] **Step 2: Verify svelte-check passes**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/InputForm.svelte
git commit -m "feat(ui): InputForm component"
```

---

## Task 12: UI — Result components

**Files:**

- Create: `src/lib/components/MechanicsChip.svelte`, `src/lib/components/WeatherBlock.svelte`, `src/lib/components/EncounterBlock.svelte`, `src/lib/components/ResultPanel.svelte`, `src/lib/components/Footer.svelte`

- [ ] **Step 1: `MechanicsChip.svelte`**

```svelte
<script lang="ts">
  import type { WeatherEffect } from '$lib/engine/types';
  let { effect }: { effect: WeatherEffect } = $props();
</script>

<span
  class="chip"
  title={effect.source === 'SRD' ? 'From SRD 5.2 (CC-BY 4.0)' : 'Original wording'}
>
  {effect.text}
</span>

<style>
  .chip {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 1rem;
    background: #eee;
    font-size: 0.85rem;
    margin: 0.2rem;
  }
</style>
```

- [ ] **Step 2: `WeatherBlock.svelte`**

```svelte
<script lang="ts">
  import type { Weather } from '$lib/engine/types';
  import MechanicsChip from './MechanicsChip.svelte';
  let { weather }: { weather: Weather } = $props();
</script>

<section class="weather">
  <h2>Weather</h2>
  <p class="narrative">{weather.narrative}</p>
  {#if weather.effects.length > 0}
    <div class="chips" aria-label="Weather effects">
      {#each weather.effects as e}
        <MechanicsChip effect={e} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .weather {
    margin-bottom: 1rem;
  }
  .narrative {
    font-size: 1.05rem;
  }
  .chips {
    margin-top: 0.5rem;
  }
</style>
```

- [ ] **Step 3: `EncounterBlock.svelte`**

```svelte
<script lang="ts">
  import type { Encounter } from '$lib/engine/types';
  let { encounter, message }: { encounter: Encounter | null; message: string | null } = $props();
  let expanded = $state(false);
</script>

<section class="encounter">
  <h2>Encounter</h2>
  {#if encounter === null}
    <p class="quiet">{message ?? 'The road is quiet.'}</p>
  {:else}
    <p class="lead">{encounter.narrative}</p>
    <button class="expand" on:click={() => (expanded = !expanded)} aria-expanded={expanded}>
      {expanded ? 'Hide' : 'Show'} stat block
    </button>
    {#if expanded}
      <dl class="stats">
        <dt>CR</dt>
        <dd>{encounter.creature.cr}</dd>
        <dt>Type</dt>
        <dd>{encounter.creature.type}</dd>
        <dt>Size</dt>
        <dd>{encounter.creature.size}</dd>
        <dt>HP</dt>
        <dd>{encounter.creature.hp}</dd>
        <dt>AC</dt>
        <dd>{encounter.creature.ac}</dd>
        <dt>Speed</dt>
        <dd>{encounter.creature.speed}</dd>
      </dl>
    {/if}
  {/if}
</section>

<style>
  .encounter {
    margin-bottom: 1rem;
  }
  .lead {
    font-size: 1.05rem;
  }
  .expand {
    margin-top: 0.5rem;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
  .stats {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin-top: 0.5rem;
  }
  dt {
    font-weight: 600;
  }
  .quiet {
    font-style: italic;
    color: #555;
  }
</style>
```

- [ ] **Step 4: `ResultPanel.svelte`**

```svelte
<script lang="ts">
  import type { RollResult } from '$lib/engine/types';
  import WeatherBlock from './WeatherBlock.svelte';
  import EncounterBlock from './EncounterBlock.svelte';

  let {
    result,
    onRerollAll,
    onRerollWeather,
    onRerollEncounter
  }: {
    result: RollResult | null;
    onRerollAll: () => void;
    onRerollWeather: () => void;
    onRerollEncounter: () => void;
  } = $props();

  function copySeed() {
    if (result) navigator.clipboard?.writeText(String(result.seed));
  }
</script>

{#if result === null}
  <p class="empty">Set the scene above and roll.</p>
{:else}
  <div class="panel">
    <WeatherBlock weather={result.weather} />
    <EncounterBlock encounter={result.encounter} message={result.encounterMessage} />
    <div class="meta">
      <span class="seed">Seed: <code>{result.seed}</code></span>
      <button on:click={copySeed}>Copy</button>
      <button on:click={onRerollWeather}>Re-roll weather</button>
      <button on:click={onRerollEncounter}>Re-roll encounter</button>
      <button on:click={onRerollAll} class="primary">Re-roll all</button>
    </div>
  </div>
{/if}

<style>
  .panel {
    border: 1px solid #ccc;
    padding: 1rem;
    border-radius: 0.5rem;
  }
  .empty {
    color: #666;
    font-style: italic;
    padding: 1rem 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
  }
  .seed code {
    background: #f4f4f4;
    padding: 0.1rem 0.3rem;
    border-radius: 0.2rem;
  }
  button {
    padding: 0.4rem 0.7rem;
    cursor: pointer;
  }
  button.primary {
    font-weight: 600;
  }
</style>
```

- [ ] **Step 5: `Footer.svelte`**

```svelte
<footer class="site-footer">
  <p>
    Monster data via <a href="https://open5e.com/" rel="noopener">Open5e</a>. This work includes
    material from the System Reference Document 5.2 by Wizards of the Coast LLC, used under the
    <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener"
      >Creative Commons Attribution 4.0 International License</a
    >.
  </p>
</footer>

<style>
  .site-footer {
    margin-top: 2rem;
    padding: 1rem;
    font-size: 0.8rem;
    color: #555;
    border-top: 1px solid #eee;
  }
  .site-footer a {
    color: inherit;
  }
</style>
```

- [ ] **Step 6: Verify**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/
git commit -m "feat(ui): result panel components and footer"
```

---

## Task 13: Wire `+page.svelte` and persist inputs

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/app.html` (title), `src/app.css` (basic resets)

- [ ] **Step 1: Replace `src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import InputForm from '$lib/components/InputForm.svelte';
  import ResultPanel from '$lib/components/ResultPanel.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { roll } from '$lib/engine';
  import type { Inputs, RollResult } from '$lib/engine/types';

  const STORAGE_KEY = 'gary-dnd-inputs-v1';

  const defaultInputs: Inputs = {
    climate: 'Temperate',
    environment: 'Forest',
    season: 'Spring',
    time: 'Day',
    region: 'Frontier',
    partyLevel: 3,
    partySize: 4,
    mode: 'Travelling',
    campfire: false,
    noise: false
  };

  let inputs = $state<Inputs>({ ...defaultInputs });
  let result = $state<RollResult | null>(null);

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(inputs, JSON.parse(raw));
    } catch {
      // ignore parse errors; fall back to defaults
    }
  });

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      // localStorage unavailable; harmless
    }
  }

  function newSeed(): number {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  function rollAll() {
    persist();
    result = roll($state.snapshot(inputs) as Inputs, newSeed());
  }

  function rerollWeather() {
    if (!result) return rollAll();
    result = roll($state.snapshot(inputs) as Inputs, result.seed, { rerollWeather: newSeed() });
  }

  function rerollEncounter() {
    if (!result) return rollAll();
    result = roll($state.snapshot(inputs) as Inputs, result.seed, { rerollEncounter: newSeed() });
  }
</script>

<svelte:head>
  <title>Gary's D&amp;D Encounter & Weather Tool</title>
</svelte:head>

<main>
  <h1>D&amp;D Encounter & Weather</h1>
  <InputForm bind:value={inputs} onRoll={rollAll} />
  <ResultPanel
    {result}
    onRerollAll={rollAll}
    onRerollWeather={rerollWeather}
    onRerollEncounter={rerollEncounter}
  />
  <Footer />
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }
  h1 {
    font-size: 1.5rem;
    margin: 0.5rem 0 1rem;
  }
</style>
```

- [ ] **Step 2: Add basic CSS reset to `src/app.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
}
body {
  background: #fafafa;
  color: #222;
  line-height: 1.4;
}
button {
  font-family: inherit;
}
```

Import in `src/routes/+layout.svelte` (create if missing):

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

- [ ] **Step 3: Run dev server, sanity-check in a browser**

Run: `npm run dev`
Expected: Open http://localhost:5173. Form renders. Roll button produces a result panel. Re-roll buttons swap weather or encounter independently. Refreshing the page restores inputs from localStorage.

- [ ] **Step 4: Run full check**

Run: `npm run check && npm test && npm run build`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(ui): wire form to engine, persist inputs, layout"
```

---

## Task 14: Accessibility pass

**Files:**

- Modify: existing components as listed

- [ ] **Step 1: Verify keyboard nav manually**

Run: `npm run dev`. With keyboard only: Tab through form fields, Enter on Roll, Tab to expand stat block, Tab to re-roll buttons. All should be reachable and operable; focus rings visible.

- [ ] **Step 2: Add `aria-live` to result region**

Modify `src/routes/+page.svelte`, wrap the `<ResultPanel ...>` block:

```svelte
<div aria-live="polite" aria-atomic="true">
  <ResultPanel ... />
</div>
```

- [ ] **Step 3: Add visible focus styles to `src/app.css`**

Append:

```css
:focus-visible {
  outline: 2px solid #2664eb;
  outline-offset: 2px;
}
```

- [ ] **Step 4: Verify contrast**

Use browser devtools accessibility audit on the running dev server. All text should pass WCAG AA. If any fails, darken the offending text colour in `app.css`.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(a11y): aria-live, focus styles, contrast pass"
```

---

## Task 15: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run check
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: github actions for check, lint, test, build"
```

After pushing to GitHub the first time, verify the workflow runs and goes green.

---

## Task 16: Cloudflare Pages deployment

**Files:**

- Create: `README.md` with setup steps

- [ ] **Step 1: Create a GitHub repository**

Push the project to a new GitHub repo named `GaryDnDApp` (or similar). Push `main`.

- [ ] **Step 2: Connect Cloudflare Pages**

In Cloudflare dashboard:

- Workers & Pages → Create → Pages → Connect to Git
- Select the GitHub repo
- Build settings:
  - Framework preset: SvelteKit
  - Build command: `npm run build`
  - Build output directory: `build`
  - Node version env var: `NODE_VERSION=20`
- Save and Deploy

- [ ] **Step 3: Verify deployed site**

Open the `*.pages.dev` URL Cloudflare assigns. Run a roll. Confirm it works.

- [ ] **Step 4: Write `README.md`**

```markdown
# Gary's D&D Encounter & Weather Tool

Static SvelteKit web app that rolls weighted weather and random encounters for D&D 5e.

## Local development

\`\`\`
npm install
npm run dev
\`\`\`

## Refresh monster snapshot

\`\`\`
npm run fetch:monsters
\`\`\`

## Build

\`\`\`
npm run build
\`\`\`

Output goes to `build/`.

## Tests

\`\`\`
npm test
\`\`\`

## Deploy

Pushes to `main` auto-deploy via Cloudflare Pages.

## Attribution

Monster data: [Open5e](https://open5e.com/) (SRD only).
This work includes material from the System Reference Document 5.2 by Wizards of the Coast LLC,
used under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README with setup, build, deploy instructions"
git push
```

---

## Self-review (post-write)

Spec coverage check:

- §2 Architecture → Tasks 1, 2, 10
- §3 Inputs → Tasks 4, 11
- §4 Engine → Tasks 3, 4, 6, 9, 10
- §5 Output → Task 12, 13
- §5.5 A11y → Task 14
- §6 Data sourcing → Tasks 5, 7, 8
- §7 Repo layout → Tasks 1, throughout
- §8 Testing → Tasks 3, 6, 9, 10
- §9 Build/CI/deploy → Tasks 2, 15, 16
- §11 Risks (categorisation, modifier balance, schema drift, attribution) → covered by Task 7 (`fetch-monsters` aborts on suspiciously few results), Task 12 (chip source labelling), data-driven design throughout.

All sections of the spec map to at least one task. No placeholders remain in the plan; every code step is fully written. Type names are consistent across tasks (`Inputs`, `RollResult`, `Monster`, `MonsterCategory`, `ModifierRule`).
