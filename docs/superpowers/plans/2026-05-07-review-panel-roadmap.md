# Review Panel Implementation Roadmap

Source: `.review-panel/2026-05-07_2200.md` (panel run on `main` @ b7a44b8).

**Branch policy:** never commit to `main` directly. Each item below lands as its own feature branch, opened from `main`, merged via fast-forward or squash once verified. WIP branches (`wip/...`) only when handing off mid-work.

---

## Stage 1: Foundations (parallel-safe, land these first)

These three branches are independent of each other and unblock everything downstream.

### `fix/data-schema-and-validation`

Closes: Principal Engineer HIGHs (slug collision, name-only dedupe, no schema version, duplicated types, no runtime validation), AppSec LOWs (Open5e response trust, host pinning), `proficiencyBonus` null mismatch, categorise ordering.

- Import `Monster` and `MonsterCategory` into `scripts/fetch-monsters.ts` and `scripts/categorise.ts` from `src/lib/engine/types.ts`. Delete the duplicate `NormalisedMonster` and the third copy of the category union.
- Add a `schemaVersion` string to `monsters.json`; engine asserts it on load and refuses to roll on mismatch.
- Replace `as unknown as Monster[]` in `src/lib/engine/index.ts:25` and the `modifiersData` cast in `encounter.ts:9` with a runtime parser (Zod or hand-written guard).
- Fix slug derivation at `scripts/fetch-monsters.ts:240` so SRD 5.1 and SRD 5.2 versions of the same creature don't collide. Carry `document_slug` separately, dedupe by `(slug, edition)`, log dropped duplicates.
- Replace the name-only `< 50` dedupe floor with an explicit allow-list of expected duplicates.
- Atomic write of `monsters.json` (temp file plus rename); retry/backoff on Open5e 5xx; verify pagination `next` URL is on `api.open5e.com` before following.
- Length-cap and field-allow-list on every Open5e string before bake-in.
- Chain `categorise` into `npm run fetch:monsters` so the script order is fixed and `category` is always present.
- Reconcile `proficiencyBonus`: pick `number | null` or `?: number` and align type and JSON.
- New CI step: load `monsters.json` and `encounter-modifiers.json` through the parser. Fail build on shape drift.

Size: medium. Worth doing first because every other branch that touches types gets simpler once duplication is gone.

### `fix/engine-di-seams`

Closes: Staff Engineer HIGHs, most CS Specialist findings.

- `roll(inputs, seed, opts, monsters?)`: accept the pool as a parameter; default to the bundled snapshot.
- Same shape for modifiers in `encounter.ts`: pass them in, default-bind at the boundary.
- Send `RerollOptions.rerollWeather` / `rerollEncounter` through `deriveSeed`, matching the no-override path. Document the contract.
- Type `crWindow(region: RegionType)` instead of `string`.
- Range-check `partySize` (1..8) and `partyLevel` (1..20) at the engine boundary; throw a typed error.
- Reject negative weights in `pickIndex`; pick one place to enforce the contract (delete the duplicate guard in `encounterPick`).
- Add `min <= max` invariant in `crWindow`.
- Guard `applyMultipliers` against `NaN`/`Infinity` propagation.
- Move weather severity classifier from `encounter.ts:32` into `weather.ts` and export it.
- Cache `applyModifiers` between `encounterCheck` and `encounterPick` so it runs once per `roll()`.

Size: small to medium.

### `fix/state-and-storage-validation`

Closes: QA HIGHs (`localStorage` blind merge, `Math.random` injection), Frontend MEDIUMs (`isComplete` not derived, `$effect` writing back through `$bindable`).

- Validate the `localStorage` payload against the inputs schema before `Object.assign`. Drop unknown shapes silently. Remove the implicit `v1` migration debt by clearing the `v1` key on first run.
- Move the campfire auto-clear `$effect` from `InputForm.svelte` to `+page.svelte` (state owner) so it doesn't re-write through the binding.
- Make `isComplete(inputs)` a `$derived(...)`.
- Wrap `Math.random()` in a small injectable `newSeed()` module so tests can pin it.

Size: small.

---

## Stage 2: Coverage, accessibility, performance (parallel after Stage 1)

### `feat/test-coverage-uplift`

Depends on Stage 1 (DI seams plus injectable seed).

- Engine boundaries: `partyLevel=1`, `partyLevel=20`, `partySize=1`, `partySize=8`.
- All-zero-weights path: construct a modifier set that zeroes every category in the pool.
- "Encounter happens, pool empty" branch in `roll()`.
- Weather forced-`Light` fallback: rig weights so the retry loop must exhaust.
- Direct tests for `pickIndex`, `pickFrom`, `rollD100` against empty / all-zero / negative / single-element inputs.
- Strengthen the seed-independence test to check sequence inequality, not a single value.
- Re-rig the "never Hot+Heavy" test with `climate=Tropical season=Summer` so it actually exercises the guard.
- Schema-shape contract tests that run `monsters.json`, `encounter-modifiers.json`, `climate-weather.json` through the runtime parser.
- Switch Vitest config so component tests run in `jsdom`; add smoke tests for `Stepper`, `InputForm`, `ResultPanel`, `EncounterBlock`.
- One Playwright e2e for the happy path: pick five settings, roll, see a result, copy the seed.

Size: medium to large. Set up component and engine as separate Vitest projects.

### `fix/a11y-focus-and-motion`

Independent of Stage 1.

- Add `:focus-visible` rings on `.seg` and `.pad` so keyboard focus is visible on the wrapper.
- Global `@media (prefers-reduced-motion: reduce)` block disabling transforms, the radial body gradient, and hover translations.
- Bump `.seg`/`.pad` min-height to ~44pt; loosen the stack gap.
- Replace 1px-opacity-0 hidden inputs with the standard `clip-path: inset(50%)` sr-only pattern.

Size: small.

### `fix/a11y-semantics-and-aria`

Independent of Stage 1; larger because it touches several components.

- Pick one path for the segmented control: roving-tabindex with arrow-key handling, or revert to native `<input type="radio">` plus `<label>` with `pointer-events` left alone. Native is simpler.
- Drop `role="table"` in `EncounterBlock.svelte:93`; use a real `<table>` or a `<dl>`.
- Give the stat-block disclosure an `id`; wire `aria-controls` on the toggle.
- Make `Stepper` a `role="spinbutton"` with `aria-valuenow/min/max`; drop the redundant value `aria-live`.
- Scope the `+page.svelte` `aria-live` region to a short status string only; take the panel content out of it.
- `aria-hidden` the rotate glyphs on the reroll buttons.
- Move emoji out of `<select>` option text (or set `aria-label` without it) so screen readers don't double up.
- Give `MechanicsChip` an icon or text prefix per severity so info/warn/danger isn't conveyed by background color alone.
- Add `aria-disabled="true"` to the campfire pad's visible target when the input is disabled.
- Replace the em-dash in the `<title>` with a colon or pipe.
- `aria-describedby` ties the seed `<code>` to its label.

Size: medium.

### `perf/code-split-monsters-and-fonts`

Depends on `fix/engine-di-seams` so `roll()` can take an injected pool.

- Replace the static `import monstersData from '../data/monsters.json'` with a dynamic `await import()` kicked off from `+layout.ts` `load` so the ~545 KB chunk lands behind the splash.
- Self-host Cinzel plus Inter (woff2 subsets) or `<link rel="preconnect">` plus `<link rel="preload">`. Drop the render-blocking CSS `@import`.
- Hoist `formatNumberMap(c.savingThrows)` and `formatNumberMap(c.skills)` via `$derived` in `EncounterBlock.svelte`.

Size: small to medium.

---

## Stage 3: UX and visual polish

### `feat/form-ux-feedback`

- Persistent field labels above Setting selects (not as placeholder options).
- Inline hint next to the disabled Roll button naming the missing fields.
- Copy-button feedback: switch label to "Copied" briefly with a status announcement; handle clipboard rejection.
- Reconcile primary action: either move "Roll again" back up to where Roll lived, or recolour the Roll button into "Roll again" once a result exists.
- Show stat block: add a chevron that rotates on `aria-expanded`.
- "(unlocks at camp)" caption near the disabled campfire pad.
- Stepper: add an editable number input alongside +/-; hold-to-repeat via `pointerdown`/`pointerup` interval.

Size: medium.

### `style/visual-polish`

Land this after `fix/a11y-semantics-and-aria` so affirmative-state text changes don't conflict.

- Affirmative state text or weight on noise/campfire pads (also closes the color-only-state a11y finding).
- Restructure reroll bar: primary "Roll again" gets full chunky styling; per-stream rerolls become secondary ghost buttons.
- Reduce H1 cap or add breathing room above the form.
- `min-width` and `justify-self` on the mobile Roll button so it keeps its presence below 640px.
- Replace vendor emoji in selects with themed inline SVG icons.
- Remove the dead `grid-template-columns: 9.5rem 1fr` rule.
- Pick one emphasis for stat-block lead-ins (italic or bold, not both).
- Bump chip border alpha so warn/danger chips have visible edges; review the SRD source dot.
- Reduce the label-tier count to two per fieldset.
- Match the Stepper +/- glyph weight to the value digit.
- Decide the result-panel hairline: bump alpha or drop it.
- Stop using Cinzel below ~0.85rem; use Inter smallcaps for legends instead.
- Add a gold accent glint to `static/favicon.svg`.

Size: medium to large but visually contained.

---

## Stage 4: Operational

### `feat/service-worker-killswitch`

Lands after `feat/test-coverage-uplift` so SW tests have a home.

- Versioned kill-switch (constant in source, bumped per-deploy) that triggers `unregister()` from `activate`.
- Bound the runtime cache: max N entries with LRU eviction, `max-age` on cached responses.
- Handle the `cache.put` rejection in `respondWith`.
- Mock-Cache tests for the SW.

Size: medium.

### `feat/observability`

- Log `seed`, top-level `inputs`, and a result digest on every `roll()` to `console.info` so a user reporting a bug can hand back the seed for reproduction.
- Decide separately whether to wire a lightweight error reporter (Sentry-lite, Cloudflare Pages function). Optional.

Size: small if console-only.

### `chore/security-defense-in-depth`

- Add a `_headers` file at the static root with a default-deny CSP (`script-src 'self'; object-src 'none'; base-uri 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` baseline.
- Add an `npm audit --omit=dev --audit-level=high` step or `dependency-review-action` to `.github/workflows/ci.yml`.

Size: small.

---

## Order of attack

1. **Stage 1**, three branches in parallel. Land all three before Stage 2.
2. **Stage 2**, four branches in parallel.
3. **Stage 3**, form UX first, visual polish after a11y semantics has landed.
4. **Stage 4**, SW kill-switch first, then observability, then CSP and dependency review.

If only two branches' worth of appetite to start: `fix/data-schema-and-validation` and `fix/a11y-focus-and-motion`. Those close the highest-impact correctness and accessibility findings without touching the visual identity.
