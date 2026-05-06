# Gary's D&D Encounter & Weather Tool — Design

**Date:** 2026-05-06
**Status:** Draft, pending review
**Author:** Aiden (SynapsEase) for Gary Askham

## 1. Purpose

A small web tool a 5e D&D Dungeon Master (Gary) uses at the table during prep and during play. The DM punches in environmental and party context, presses a button, and gets back a plausible weather report and a random encounter (or "no encounter"), with the input variables actually shaping the probabilities of what comes out.

Secondary purpose: a learning project for the author during garden leave. Modern web stack, deployable as a static site, no servers to run.

### 1.1 What "good" looks like

- Gary opens the tool on his phone or laptop, sets the scene in under 30 seconds, hits Roll, and gets a result he can read out at the table.
- The result *feels* responsive to the inputs. Arctic tundra rolls blizzards far more often than rainforest. Camping with a fire and noise attracts bandits more than wolves. Night time biases toward predators and undead.
- Adding a new modifier rule (e.g. "in autumn, grasslands have a fog day chance") is a JSON edit, not a code change.
- Costs zero to host. Works offline once loaded.

### 1.2 Out of scope (v1)

- Tactical maps, initiative tracking, HP tracking. Use a VTT or paper.
- A history / log of past rolls. Re-roll instead.
- Editing or saving named "scenes" / presets. `localStorage` of last-used inputs only.
- User accounts, sharing, multi-user state. Single-user tool.
- Native mobile app. Mobile-responsive web is sufficient.
- Combat resolution. The tool surfaces a creature; the DM runs the fight.

## 2. Architecture

Single-page web app, fully static, no backend.

```
┌─────────────────────────────────────────┐
│  SvelteKit (static export, runs in CSR) │
│                                         │
│  ┌─────────┐    ┌───────────┐           │
│  │ Inputs  │───▶│  Engine   │──┐        │
│  │ (form)  │    │ (pure TS) │  │        │
│  └─────────┘    └───────────┘  │        │
│                       ▲        ▼        │
│                       │   ┌─────────┐   │
│                  ┌────┴───┤ Result  │   │
│                  │  Data  │ panel   │   │
│                  │ (JSON) └─────────┘   │
│                  └────────              │
└─────────────────────────────────────────┘
        ▲
        │ (build time only, run on demand)
        │
   Open5e snapshot script
   (writes static JSON to repo)
```

### 2.1 Layers

1. **UI** — Svelte components for the input form and the result panel. Single screen, no router.
2. **Engine** — pure TypeScript module. Takes `(inputs, dataTables, rng) → result`. Deterministic given a seed. No DOM, no global state, no I/O. Independently testable.
3. **Data** — static JSON files bundled with the app: `monsters.json`, `climate-weather.json`, `environment-modifiers.json`, `season-modifiers.json`, `encounter-modifiers.json`. No runtime API calls.

### 2.2 Stack

- **Framework:** SvelteKit with `@sveltejs/adapter-static` (prerendered to static HTML/CSS/JS).
- **Language:** TypeScript throughout.
- **Tests:** Vitest for unit tests; no E2E in v1.
- **Hosting:** Cloudflare Pages, deployed from GitHub on push to `main`.
- **CI:** GitHub Actions running `npm run check`, `npm test`, `npm run build`.

### 2.3 Why static + SRD-only

- Zero runtime cost, no DB, no auth, no servers.
- SRD 5.1 / 5.2 monster data is CC-BY licensed; bundling it requires only an attribution footer.
- SRD-only bounds the monster set to ~325 creatures, which keeps `monsters.json` small (well under 1 MB gzipped) and makes the manual category-tagging pass tractable. Community content can be added post-v1 without architectural change.

## 3. Inputs

The form drives the engine. All values default to sensible starting points (Temperate / Forest / Spring / Day / Frontier / Level 3 / 4 chars / Travelling / no campfire / no noise) so the first roll works without touching anything.

### 3.1 Environmental context

| Field | Type | Values |
|---|---|---|
| Climate | enum | Tropical, Subtropical, Arid, Temperate, Subarctic, Arctic |
| Environment | enum | Arctic, Coastal, Desert, Forest, Grassland, Hills, Mountains, Swamp, Underground, Urban, Wasteland |
| Season | enum | Spring, Summer, Autumn, Winter |
| Time of day | enum | Dawn, Day, Dusk, Night |
| Region type | enum | Settled, Frontier, Wilderness, Hostile |

### 3.2 Party state

| Field | Type | Range |
|---|---|---|
| Average character level | int | 1–20 |
| Number of characters | int | 1–8 |

### 3.3 Travel / camp state

| Field | Type | Notes |
|---|---|---|
| Mode | radio | Travelling \| At camp |
| Campfire | toggle | Only meaningful at camp; ignored if Travelling |
| Making noise | toggle | Applies in both modes |

### 3.4 Validation

- Climate × Environment combinations are not hard-blocked. Implausible combos still roll, with the result narrative noting "unusual conditions". Gary's spec explicitly said warm-arid-desert blizzards should be rare, not impossible.
- Numeric inputs are clamped, not rejected.

### 3.5 Persistence

Last-used input values persist in `localStorage` so Gary doesn't reset them every session. No server-side state.

## 4. Engine

The heart of the tool. Pure functions, deterministic given a seed, framework-free.

### 4.1 Pipeline

```
inputs ──▶ [1. weather] ──▶ [2. encounter check] ──▶ [3. encounter pick] ──▶ result
                │                    │                       │
                └────────── modifiers feed in ───────────────┘
```

### 4.2 Step 1 — Weather

- Each climate has a base distribution for three independent axes: Temperature, Precipitation, Wind.
- Season shifts Temperature (winter colder, summer hotter), with magnitude scaled by climate (Arctic moves little; Temperate moves a lot).
- Environment applies small overrides (Mountains push Wind up; Swamp pushes Precipitation up).
- Three independent rolls. Cross-reject impossible combinations (e.g. Heavy Snow with Hot temperature) and re-roll the offending axis.
- Output: `{ temp, precip, wind, narrative }`.

### 4.3 Step 2 — Encounter check (does one happen?)

- Base encounter chance per check: 20% (configurable in `encounter-modifiers.json`).
- Modifiers stack multiplicatively. Each modifier rule defines a condition and a multiplier on the base chance.
- Examples (illustrative, exact values authored in data):
  - Region = Hostile: ×2.0
  - Region = Settled: ×0.5
  - At camp + campfire lit: ×0.7 on overall chance (the fire is reassuring)
  - Making noise: ×1.5
  - Weather = Heavy precipitation or High wind: ×0.5 (too miserable to be out)
- Single d100 vs the resulting probability. If it fails, return `{ encounter: null }` with a flavour line ("the road is quiet").

### 4.4 Step 3 — Encounter pick

If the encounter check passes:

1. **Filter the pool.** Restrict `monsters.json` to creatures whose `environments[]` includes the selected environment.
2. **Apply CR window.** Compute `[crMin, crMax]` from party level + size, using the SRD 5.2 encounter-budget formula. Region type widens or narrows the window (Hostile pushes ceiling up, Settled pulls it down).
3. **Empty-pool fallback.**
   - If the filtered pool is empty, widen the CR window by ±50% and try again.
   - If still empty, return `{ encounter: null }` with a hint string: *"No matching creatures for this environment + party. Try loosening filters."*
   - Never throw.
4. **Compute category weights.** Each creature carries an internal `category` tag (Predator, Bandit, Undead, Fey, Aberration, Civilised, Construct, Other). Modifier rules from `encounter-modifiers.json` produce per-category multipliers given the inputs. Example:
   - Night + Wilderness + no campfire → Predator ×3, Undead ×2, Civilised ×0.2
   - Camp + campfire + making noise → Bandit ×2.5, Predator ×0.8
5. **Pick a category** weighted by those multipliers, then pick a creature from that category, biased toward the middle of the CR window.
6. **Decide quantity** from CR vs party budget (lower-CR creatures appear in groups, higher-CR usually solo).
7. Output: `{ creature, count, narrative, contributingModifiers[] }`.

### 4.5 Determinism and seeding

- The engine takes an explicit seeded RNG (mulberry32 or similar simple PRNG).
- A single roll uses a parent seed. Sub-steps (weather, encounter check, encounter pick) derive sub-seeds from the parent so partial re-rolls (weather only, encounter only) are well-defined and don't shift each other's outputs.
- The seed is shown in the UI and copyable; same seed + same inputs always reproduces the same result.

### 4.6 Data files

| File | Authored by hand | Generated |
|---|---|---|
| `monsters.json` | category tags only | rest from Open5e snapshot script |
| `climate-weather.json` | yes (six climates × three weather axes) | — |
| `environment-modifiers.json` | yes (small weather overrides per environment) | — |
| `season-modifiers.json` | yes (small temp shifts per season per climate) | — |
| `encounter-modifiers.json` | yes (this is the heart of the maths) | — |

`encounter-modifiers.json` is structured as a list of rules:

```json
{
  "rules": [
    {
      "id": "night-wilderness-predators",
      "when": { "time": "Night", "region": "Wilderness", "campfire": false },
      "categoryMultipliers": { "Predator": 3.0, "Undead": 2.0, "Civilised": 0.2 },
      "narrativeFragment": "hunting in the dark"
    }
  ]
}
```

New rules are added by editing the file. No code change required to retune the feel of the app.

## 5. Output / result panel

A single result card replaces its contents on each roll. Scannable top to bottom.

### 5.1 Weather block

A plain-English narrative line, e.g.:

> *Cool, with light rain and a steady wind from the west.*

Below, a row of small **mechanics chips** lists effects that matter at the table:

- *Disadvantage on Wisdom (Perception) checks relying on sight or hearing*
- *Travel pace ½*
- *Constitution save vs exhaustion every hour without protection*

Chips come from a static map of weather-state → effect text. Wording must be either lifted directly from SRD 5.2 (CC-BY, attributed in footer) or paraphrased into our own prose. Before authoring, verify which weather effects are actually in SRD 5.2 vs DMG-only. Any DMG-only mechanic must be paraphrased rather than quoted.

If no effects apply, no chips are shown.

### 5.2 Encounter block

Two states.

*No encounter:*

> *The road is quiet. (Travel continues without incident.)*

Or, on empty-pool fallback:

> *No matching creatures for this environment + party. Try loosening filters.*

*Encounter:*

> *2 **wolves** approach from the treeline.*

The creature name is an expander. Click to reveal the stat block summary: CR, type, size, AC, HP, speed, abilities. All from the Open5e snapshot.

Below the headline, a **disposition / context line** built from the modifier rules that fired:

> *Drawn by the noise of your camp. Hunting in the dusk.*

Each rule that contributed to the pick can include a `narrativeFragment` which gets concatenated into this line. Keeps the maths legible to the DM.

### 5.3 Meta row

- Seed, displayed in monospace, with a copy button.
- **Re-roll** (everything, new parent seed).
- **Re-roll weather only** (new weather sub-seed, encounter unchanged).
- **Re-roll encounter only** (new encounter sub-seed, weather unchanged).

### 5.4 Empty state

Before the first roll: *"Set the scene above and roll."* No spinner; engine completes within a frame.

### 5.5 Accessibility

- Keyboard navigation throughout: Tab order matches reading order, Roll button reachable without mouse, all toggles operable via Space/Enter.
- Form fields have labels; chips have screen-reader-friendly text (not icon-only).
- Colour is not the only signal for chip severity.
- WCAG AA contrast on all text.

## 6. Data sourcing & licensing

### 6.1 Monsters

- Source: Open5e v2 API, filtered to SRD documents only (`document__key` matching SRD 5.1 / 5.2 keys).
- Snapshot script `scripts/fetch-monsters.ts` runs on demand (not on every build) and writes `src/lib/data/monsters.json`. The committed JSON is the source of truth at build time.
- Normalised shape per creature: `{ slug, name, cr, type, size, environments[], hp, ac, speed, statblock, category }`.
- The script validates the response against an expected schema and fails loudly if Open5e changes field names, so silent breakage is impossible.
- The `category` field is populated by a second script `scripts/categorise.ts` that combines type-based heuristics (Undead, Fey, Construct, Aberration map directly from `type`) with a small hand-curated overrides file for the harder cases (Predator vs prey beasts; Bandit vs Civilised humanoids).

### 6.2 Weather and rules text

- Hand-authored. The dataset is small (a few dozen rows total).
- Mechanical effect text in chips must come from SRD 5.2 (CC-BY 4.0) or be original prose. Verify per-effect before authoring.

### 6.3 Attribution

- Footer credits Open5e and includes the canonical Wizards of the Coast SRD 5.2 attribution string ("This work includes material from the System Reference Document 5.2 by Wizards of the Coast LLC, used under the Creative Commons Attribution 4.0 International License"). The exact URL and wording are taken verbatim from WotC's published attribution requirements at implementation time.
- Repository LICENSE files note the bundled SRD content's CC-BY status separately from the application code's licence.

## 7. Repo layout

```
GaryDnDApp/
├── src/
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── weather.ts
│   │   │   ├── encounter.ts
│   │   │   ├── rng.ts
│   │   │   └── index.ts        ← roll(inputs, rng) → result
│   │   ├── data/               ← static JSON imports
│   │   │   ├── monsters.json
│   │   │   ├── climate-weather.json
│   │   │   ├── environment-modifiers.json
│   │   │   ├── season-modifiers.json
│   │   │   └── encounter-modifiers.json
│   │   └── components/
│   │       ├── InputForm.svelte
│   │       ├── ResultPanel.svelte
│   │       ├── WeatherBlock.svelte
│   │       ├── EncounterBlock.svelte
│   │       └── MechanicsChip.svelte
│   ├── routes/
│   │   └── +page.svelte
│   └── app.html
├── scripts/
│   ├── fetch-monsters.ts
│   └── categorise.ts
├── tests/
│   └── engine/
├── docs/
│   └── superpowers/specs/
├── .github/workflows/ci.yml
├── svelte.config.js
├── tsconfig.json
└── package.json
```

## 8. Testing

### 8.1 Engine unit tests (Vitest)

Pure functions, deterministic with seeded RNG. Coverage targets:

- **Weather distributions** — 10k seeded rolls per climate; assert the empirical distribution falls within tolerance of the configured base distribution. Seeded so the test itself is deterministic; no flakiness.
- **Impossible-combo rejection** — Heavy Snow + Hot never appears in N seeded rolls.
- **Encounter modifier composition** — given known rule sets, the resulting probability matches manual calculation.
- **CR window** — respects party level × size × region type, including widening fallback.
- **Empty-pool fallback** — synthetic empty monster pool yields `{ encounter: null }` with hint, not a throw.
- **Same seed + same inputs → identical output** (regression guard).
- **Sub-seed isolation** — re-rolling weather alone leaves encounter result identical, and vice versa.

### 8.2 Snapshot tests

Narrative templates: a handful of fixed (input, seed) pairs produce stable strings. Easy to update intentionally, hard to regress unintentionally.

### 8.3 What's not tested in v1

- E2E browser tests. The UI is a thin shell over the engine; engine coverage gives most of the value. Add Playwright later if useful.
- Visual regression. Not worth the maintenance for a single-screen app.

## 9. Build, CI, deployment

- **Local dev:** `npm run dev`. Hot reload. No env vars, no secrets, no DB.
- **Build:** `npm run build`. Static output ready for any static host.
- **CI:** GitHub Actions on push and PR. Runs `npm run check` (svelte-check), `npm test`, `npm run build`. Fails on type errors, test failures, or build errors.
- **Deploy:** Cloudflare Pages connected to the GitHub repo. Auto-deploy on push to `main`. Preview deploys on PRs. Build command `npm run build`, output dir per `adapter-static` config.
- **Cost:** £0. Cloudflare Pages free tier has unlimited bandwidth on static assets.

## 10. Open questions for after v1

These are deliberately not in scope but worth recording so they aren't forgotten:

- Per-day weather continuity (today's weather influences tomorrow's, rather than independent rolls).
- Optional history / session log of recent rolls.
- Initiative / combat helper as a separate page (only if Gary actually wants it; many DMs prefer their existing tools).
- Community content beyond SRD (more monsters, but bigger category-tagging pass and license review).
- An admin / editing UI so Gary can tune `encounter-modifiers.json` without editing JSON by hand.
- PWA install + offline cache (web app already works offline once loaded; this just adds the home-screen icon).

## 11. Risks

- **Category tagging quality.** "Predator" vs "prey beast" vs "civilised humanoid" requires per-monster judgement. Mitigation: bound to SRD-only (~325 creatures), use type-based heuristics where they map cleanly, keep an overrides file checked into the repo.
- **Modifier balance.** First version of `encounter-modifiers.json` will feel wrong. This is expected and the data-driven design is specifically to make retuning cheap.
- **Open5e schema drift.** Mitigation: snapshot script validates response shape and fails loudly. App build never hits the network, so a broken Open5e doesn't break deploys.
- **SRD attribution mistakes.** Quoting DMG-only text under a CC-BY footer is misattribution. Mitigation: per-effect verification before authoring chips; default to original prose when unsure.
