# PRD: Fourth Watch Review Panel Implementation

| Field | Value |
| --- | --- |
| Product | Fourth Watch (static SvelteKit + Cloudflare Pages D&D 5e weather and encounter app) |
| Version | 1.0 |
| Author | [PLACEHOLDER: Author name] |
| Date | 2026-05-07 |
| Source review | `.review-panel/2026-05-07_2200.md` |
| Roadmap | `docs/superpowers/plans/2026-05-07-review-panel-roadmap.md` |
| Loop artefacts | `docs/superpowers/plans/review-panel-prd/{progress.txt, prd.json}` |

## 1. Executive Summary

A 10-reviewer review panel (UX, Frontend, Graphic Design, Accessibility, Infosec, AppSec, Principal Engineer, Staff Engineer, QA, CS Specialist) ran against the project on `main` @ `b7a44b8` and produced 100+ findings clustered into 12 implementation branches across 4 stages. Two Stage 1 foundation branches have already been built and verified: `fix/data-schema-and-validation` and `fix/engine-di-seams`. This PRD covers the 10 remaining branches and is structured for a Ralph Loop run: each user story corresponds to one branch, with acceptance criteria written so an autonomous runner can verify completion before moving on.

## 2. Problem Statement

Recent feature work shipped a richer stat block and 5.2 SRD data refresh, then a multi-perspective review surfaced systemic issues across accessibility, build pipeline correctness, engine testability, and operational hygiene. Many findings are individually small but cluster into coherent themes. Without a planned, sequenced effort the work either stalls (too many concerns to tackle ad-hoc) or risks shipping partial fixes that interact poorly.

The two completed Stage 1 branches addressed schema validation, slug-based dedupe, defensive Open5e fetching, and engine DI seams. They establish the contracts that the remaining branches build on: localStorage validation can use the schema-version pattern, test-coverage uplift can use the injectable monster catalog, accessibility work can rely on the engine being deterministic.

The risk if this work doesn't land: every accessibility finding remains unfixed (segmented control unreachable by keyboard, no `prefers-reduced-motion` handling, severity-by-color-only chips), the bundle still ships ~545 KB monsters.json synchronously on first paint, no UI test layer exists, and a bad service-worker deploy has no kill switch. None of these are individually catastrophic; together they make the app feel unfinished.

## 3. Goals & Success Metrics

### Primary goals

1. Close every HIGH-severity finding from the review panel report.
2. Establish a UI test layer (component-level + at least one Playwright e2e) so future regressions are caught.
3. Cut initial bundle weight by code-splitting the monster catalog so first paint doesn't pay for it.
4. Make the app pass an automated accessibility audit on key flows.

### Success metrics

| Metric | Current | Target |
| --- | --- | --- |
| HIGH-severity findings closed | 0 of N | 100% |
| Initial JS bundle (gzip) | dominated by monsters.json (~150 KB gz) | <50 KB gz pre-roll |
| `prefers-reduced-motion` honoured | no | yes |
| Test count | 50 (engine only) | 70+ including component and e2e |
| `npm run validate:data` step | added | passes in CI on every push |
| Service-worker kill switch | none | versioned, tested |

## 4. Scope — In and Out

### In scope

- Every branch listed in the roadmap's Stages 1 (remaining), 2, 3, and 4.
- New tests required by changed code (per branch).
- Drive-by lint or formatting fixes that block CI.
- Updates to `validate:data` and `ci.yml` if a branch changes data shapes or adds a check.

### Out of scope

- Visual identity refresh beyond what `style/visual-polish` lists.
- Any new product feature (campaign tracking, shareable rolls, account system).
- Migration to a different framework or hosting provider.
- Re-fetching `monsters.json` from Open5e (the bundled snapshot stays unless a story explicitly requires a fresh pull).
- Anything in the future-roadmap's `+data` (Data Engineer) or `+l10n` (Localization Engineer) opt-in panels.
- Pushing to a remote or merging to `main` (the user merges manually).

## 5. User Stories

Each story is one branch from the roadmap. Acceptance criteria are written so a runner can verify completion by reading the diff, running the test suite, and inspecting the dev server. All stories assume the baseline: `npm run check`, `npm run lint`, `npm run validate:data`, `npm test` all green before and after.

### 5.1 fix/state-and-storage-validation

**As** a developer **I want** localStorage payloads validated before merge, the campfire `$effect` moved to the state owner, `isComplete` derived rather than re-called, and a mockable `newSeed` seam **so that** state corruption can't bypass the form's "all complete" guard and tests can deterministically pin the seed stream.

**Acceptance criteria:**

- A new validator (or reuse of `parseInputs`-style helper) rejects localStorage payloads that don't match the input schema; failed validation drops the payload silently and leaves in-memory state untouched.
- The `v1` storage key (`fourth-watch-inputs-v1`, if present) is cleared on first run after the migration; only `v2` is read going forward.
- The campfire auto-clear `$effect` lives in `+page.svelte` (state owner), not `InputForm.svelte`; `InputForm.svelte` no longer writes back through `$bindable`.
- `isComplete(inputs)` is consumed via `$derived(...)`, not called inline in the template.
- A new module wraps `Math.random()` (e.g. `src/lib/engine/clock.ts` or similar) so tests can supply a deterministic generator; `+page.svelte` uses the wrapper.
- New tests in `tests/engine/` cover: tampered storage payload is rejected; valid storage payload is loaded; the seed wrapper is injectable.
- Smoke test: open dev server, load the app with valid stored input, refresh, see the previous selections; corrupt localStorage manually, refresh, see no crash and a fresh form.

### 5.2 feat/test-coverage-uplift

**As** a developer **I want** boundary tests for the engine, schema-shape contract tests for the bundled data files, and a component / e2e test layer **so that** UI regressions are caught and engine edge cases are pinned to behaviour.

**Acceptance criteria:**

- Engine boundary tests added: `partyLevel=1`, `partyLevel=20`, `partySize=1`, `partySize=8`; the all-zero category-weights path; the "encounter happens, pool empty" branch in `roll()`; the weather forced-`Light` fallback (rig weights so the retry must exhaust).
- Direct tests for `pickIndex`, `pickFrom`, `rollD100` against empty / all-zero / single-element inputs.
- Schema-shape contract tests run `monsters.json`, `encounter-modifiers.json`, and `climate-weather.json` through the runtime parser (or hand-written shape checks for the weather files).
- The "never Hot+Heavy" weather invariant test is re-rigged with `climate=Tropical season=Summer` so the guard actually has a chance to fire.
- Component-test config: Vitest is configured to run a subset of test files in `jsdom` (e.g. `tests/components/**`); component smoke tests exist for `Stepper`, `InputForm`, `ResultPanel`, and `EncounterBlock`.
- One Playwright e2e covers the happy path: pick five settings, roll, see a result, click Copy, verify the seed string is in the clipboard.
- `npm test` runs all the above in under 30s on a developer laptop; CI runs them too.

### 5.3 fix/a11y-focus-and-motion

**As** a keyboard or switch user, or a user with motion-sensitivity **I want** visible focus indicators on every interactive control and animations that respect my reduced-motion preference **so that** I can use the app without losing track of focus or being made dizzy.

**Acceptance criteria:**

- `:focus-visible` styles applied to `.seg` and `.pad` so the wrapper shows a focus ring when the inner hidden input is focused.
- A global `@media (prefers-reduced-motion: reduce)` block in `app.css` disables transforms, the radial body gradient, and hover translations on `.seg`, `.pad`, `button.roll`, `.expand`, and ghost buttons.
- `.seg` and `.pad` min-height bumped to ~44pt; the stack gap between toggles loosened.
- The visually-hidden `<input>` pattern is replaced with `clip-path: inset(50%)` style sr-only.
- Manual smoke test: tab through the form, every control shows a visible ring; reduce motion in OS settings, reload, animations are disabled.

### 5.4 fix/a11y-semantics-and-aria

**As** a screen-reader or assistive-tech user **I want** the segmented control, stat-block disclosure, stepper, and live region to be announced correctly **so that** the app is intelligible without sight.

**Acceptance criteria:**

- The segmented Travelling/At camp control is either rebuilt with native `<input type="radio">` and `<label>` (no `pointer-events: none`) or implemented with a roving-tabindex pattern with arrow-key handling. Native is preferred; document the choice.
- `role="table"` removed from the abilities grid in `EncounterBlock.svelte:93`; replaced with a real `<table>` or a `<dl>`.
- The stat-block disclosure has an `id` on the article and `aria-controls` on the toggle.
- `Stepper` exposes `role="spinbutton"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`; the redundant `aria-live` on the value span is removed.
- The `+page.svelte` `aria-live` region wraps a short status string (e.g., "Rolled. Encounter: Wolves.") rather than the entire `ResultPanel`.
- Rotate glyphs on reroll buttons are `aria-hidden`.
- Emoji is removed from `<select>` `<option>` text (or option `aria-label` is set without it).
- `MechanicsChip` carries an icon or a text prefix per severity, not background color alone.
- The disabled campfire pad has `aria-disabled="true"` on the visible target.
- The em-dash in the `<title>` is replaced with a colon or pipe.
- The seed `<code>` is tied to its label via `aria-describedby`.
- New tests verify: stepper announces its value, segmented control responds to arrow keys (or whichever path was taken), live region only re-announces the status string.

### 5.5 perf/code-split-monsters-and-fonts

**As** a tabletop user opening the app on mobile **I want** the page to paint quickly so that picking my settings doesn't wait on a 545 KB monster catalog **so that** the first roll is fast.

**Acceptance criteria:**

- `roll()` no longer eagerly imports `monstersData`; the catalog is loaded via dynamic `await import()` triggered from `+layout.ts` `load` (or kicked off behind the splash on `+page.svelte` mount).
- Cinzel and Inter are self-hosted (woff2 subsets) or preloaded via `<link rel="preconnect">` + `<link rel="preload">`; the render-blocking `@import` in `app.css` is gone.
- `formatNumberMap(c.savingThrows)` and `formatNumberMap(c.skills)` in `EncounterBlock.svelte` are hoisted via `$derived`.
- `npm run build` succeeds; the initial JS chunk in `build/_app/immutable/` no longer contains the monster names (verifiable by grep).
- Smoke test: refresh dev server, observe that the splash renders before the catalog loads (or simulate slow 3G in dev tools and verify the form is interactive before the catalog finishes).
- Existing tests still pass; `roll()` defaults to the bundled catalog when called synchronously, so engine tests are unchanged.

### 5.6 feat/form-ux-feedback

**As** a user filling in the form **I want** persistent labels, an explanation when Roll is disabled, copy-button feedback, primary-action consistency, a disclosure chevron, a campfire hint, and a faster Stepper **so that** the path from "open app" to "see result" is obvious and forgiving.

**Acceptance criteria:**

- Setting select labels (Climate, Environment, Season, Time, Region) are visible above each control; the placeholder option is no longer the only label carrier.
- An inline hint near the disabled Roll button names the missing fields ("Pick climate, environment...").
- The copy button switches its label to "Copied" briefly, with a status `aria-live` that announces the success; clipboard rejection shows a transient error.
- Primary-action layout is consistent: either "Roll again" appears in the same chunky pill style as the original Roll button, or the original button transforms into "Roll again" once a result exists. Document which.
- The "Show stat block" toggle has a chevron icon that rotates on `aria-expanded`.
- The disabled campfire pad shows an "(unlocks at camp)" caption.
- The Stepper has both an editable number input and +/- buttons with hold-to-repeat (interval set on `pointerdown`, cleared on `pointerup`/`pointerleave`).
- New component tests: copy-button feedback, stepper editable-input parity with buttons, hint-while-disabled, and chevron rotation.
- Smoke test: walk the happy path with a stopwatch, the form feels faster than before.

### 5.7 style/visual-polish

**As** a user looking at the app **I want** a polished visual hierarchy with one primary action, themed icons in place of vendor emoji, and consistent typography **so that** the table presence matches the engine quality.

**Acceptance criteria:**

- Affirmative state text or weight added to noise/campfire pads (closes the "color-only state" finding from the a11y panel as well).
- Reroll bar restructured: primary "Roll again" gets the chunky button styling; per-stream rerolls become secondary ghost buttons in a row beneath.
- H1 cap reduced or breathing room added so legends below don't compete.
- Mobile Roll button has `min-width` and `justify-self` so it keeps its presence below 640px viewport.
- Vendor emoji in selects replaced with themed inline SVG icons (or stripped to plain text if no themed icons exist).
- Dead `grid-template-columns: 9.5rem 1fr` rule removed.
- Stat-block lead-ins use one emphasis (italic or bold), not both.
- Chip border alpha bumped, or warn/danger backgrounds tinted at higher saturation, so the chip edge is visible at typical viewing distance.
- Label tier count reduced to two per fieldset (legend + label, not legend + label + stat-name).
- Stepper +/- glyph weight matches the value digit weight.
- Result panel hairline border decision: bumped alpha or removed.
- Cinzel use restricted to >=0.85rem; legends below that size use Inter smallcaps.
- `static/favicon.svg` carries a gold accent glint or other brand element.
- Smoke test: side-by-side the app vs. the pre-polish screenshots, the visual hierarchy reads cleaner.

### 5.8 feat/service-worker-killswitch

**As** an operator **I want** a service-worker kill switch and a bounded runtime cache **so that** a bad deploy can't ship a broken cached shell that survives the next visit.

**Acceptance criteria:**

- A versioned kill-switch constant in source (e.g. `SW_KILL_VERSION`); when it changes, `activate` calls `self.registration.unregister()` and clears all caches.
- The runtime cache is bounded: max N entries with LRU eviction, max-age on cached responses.
- `cache.put` rejection inside `respondWith` is caught and swallowed with a debug log.
- New tests run the SW with a mock `Cache` interface and verify: kill-switch bump triggers unregister, LRU evicts oldest, cache.put rejection doesn't crash the handler.
- Manual smoke test: install the SW in dev, bump the kill-switch version, reload, verify the SW is unregistered and the app is served fresh.

### 5.9 feat/observability

**As** an operator triaging a user-reported bug **I want** a way to reproduce a roll from the seed **so that** I can inspect the exact result the user saw.

**Acceptance criteria:**

- Every `roll()` invocation logs `seed`, top-level `inputs`, and a result digest (e.g. encounter slug + count + weather summary) to `console.info`. Log lines are gated by an env flag (or build-time switch) so production console can be quiet by default but enabled per-deploy.
- An optional Cloudflare-Pages-side error-reporter hook is documented (e.g. a stub function in `+error.svelte`) but not wired in by default.
- New component test asserts the log line shape; smoke test asserts the seed is recoverable from the console log on a real roll.
- Decision documented in `docs/superpowers/plans/`: are we shipping this to prod by default, or only enabled via a query string for support?

### 5.10 chore/security-defense-in-depth

**As** a security-conscious operator **I want** a Content-Security-Policy header and a dependency-audit step in CI **so that** an XSS pivot has no script-eval surface and a known-CVE bump doesn't ship silently.

**Acceptance criteria:**

- A `_headers` file at the static root with at minimum: `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`; `Referrer-Policy: strict-origin-when-cross-origin`; a `Permissions-Policy` baseline with no opted-in features unless required.
- The CSP doesn't break Cinzel/Inter loading (self-hosted from story 5.5) and doesn't break Cloudflare's analytics if any are wired up.
- `.github/workflows/ci.yml` gains either an `npm audit --omit=dev --audit-level=high` step or a `dependency-review-action` step (the latter is preferable on PRs but only fires on PR events; pick one and document).
- Smoke test: dev server still works with the CSP applied; build still works; CI still passes; deliberately introducing a known-vulnerable dep (in a throwaway commit) makes CI fail with a clear message.

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A11y semantics work breaks visual styling on the segmented control. | Medium | Medium | Land `fix/a11y-semantics-and-aria` before `style/visual-polish`; run the screenshot smoke test after each. |
| Code-split lands but Cloudflare Pages doesn't serve the dynamic chunk correctly with the static-assets adapter. | Low | High | Verify `npm run build` output and `npm run preview` locally before merging; add a smoke test step that loads the prerendered shell and confirms the chunk arrives. |
| Service-worker kill switch is implemented but the runtime cache shape change causes a fresh install to evict legitimate SW state on first visit. | Low | Medium | Tests cover the LRU eviction and the cache-version logic; manual smoke from a fresh browser profile. |
| CSP blocks a legitimate resource (typically inline styles from SvelteKit's hydration script) and breaks the page. | Medium | High | Land CSP behind a `Content-Security-Policy-Report-Only` header first if needed; review browser console after enforcement. |
| The ralph loop marks a story passed without acceptance criteria actually being met (false-positive). | Medium | Medium | Each story's AC is written so an autonomous runner can check via test runs, file inspection, or a single yes/no smoke prompt. The skill's loop-iteration mode is required to "not mark a story passed without evidence". |

## 7. Open Questions

- Q1. Should `feat/observability` be enabled by default in prod, or gated behind a `?debug=1` query string? Default until Q1 is answered: gated, off by default.
- Q2. For `fix/a11y-semantics-and-aria`, does the visual identity allow reverting the segmented control to native radios with native focus rings? Default until Q2 is answered: yes, native is the path.
- Q3. For `style/visual-polish`, are the vendor emoji going to be replaced with custom SVG icons (more work), or simply removed (faster)? Default until Q3 is answered: removed, with a placeholder note in the visual-polish PR for the user to either commission icons or accept the plain look.
- Q4. Should `feat/service-worker-killswitch` block the user's first visit when bumped, or should it serve from cache for the current visit and unregister on the next? Default until Q4 is answered: serve from cache this visit, unregister on next.
- Q5. CSP header location: `static/_headers` (Cloudflare Pages convention) or via the SvelteKit handle hook? Default until Q5 is answered: `static/_headers`, since this is a static deploy.
