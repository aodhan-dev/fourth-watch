<script lang="ts">
  import type {
    Climate,
    Environment,
    Season,
    TimeOfDay,
    RegionType,
    TravelMode
  } from '$lib/engine/types';
  import Stepper from './Stepper.svelte';

  // Mirrors the page-level FormState — enum fields can be '' (unset) until picked.
  type FormValue = {
    climate: Climate | '';
    environment: Environment | '';
    season: Season | '';
    time: TimeOfDay | '';
    region: RegionType | '';
    partyLevel: number;
    partySize: number;
    mode: TravelMode;
    campfire: boolean;
    noise: boolean;
  };

  let {
    value = $bindable(),
    onRoll,
    canRoll
  }: { value: FormValue; onRoll: () => void; canRoll: boolean } = $props();

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

  const GLYPH = {
    Tropical: '🌴',
    Subtropical: '🌿',
    Arid: '🏜️',
    Temperate: '🌾',
    Subarctic: '🌲',
    'Arctic-c': '🧊',
    'Arctic-e': '❄️',
    Coastal: '🌊',
    Desert: '🏜️',
    Forest: '🌲',
    Grassland: '🌾',
    Hills: '⛰️',
    Mountains: '🏔️',
    Swamp: '🪷',
    Underground: '🕯️',
    Urban: '🏛️',
    Wasteland: '☠️',
    Spring: '🌱',
    Summer: '☀️',
    Autumn: '🍂',
    Winter: '❄️',
    Dawn: '🌅',
    Day: '🔆',
    Dusk: '🌆',
    Night: '🌙',
    Settled: '🏘️',
    Frontier: '🛤️',
    Wilderness: '🌲',
    Hostile: '⚔️'
  } as const;

  // Field-level glyphs used in placeholder + label.
  const FIELD = {
    climate: { glyph: '🌡️', label: 'Climate' },
    environment: { glyph: '🗺️', label: 'Environment' },
    season: { glyph: '🍃', label: 'Season' },
    time: { glyph: '🕐', label: 'Time of day' },
    region: { glyph: '🧭', label: 'Region' }
  } as const;

  // Climate "Arctic" and Environment "Arctic" share a value; pick visually distinct glyphs.
  function climateGlyph(c: string): string {
    return c === 'Arctic' ? GLYPH['Arctic-c'] : (GLYPH as Record<string, string>)[c];
  }
  function envGlyph(e: string): string {
    return e === 'Arctic' ? GLYPH['Arctic-e'] : (GLYPH as Record<string, string>)[e];
  }
  function g(k: string): string {
    return (GLYPH as Record<string, string>)[k] ?? '';
  }
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    onRoll();
  }}
  class="form"
>
  <fieldset class="party">
    <legend>Party</legend>
    <div class="stat">
      <span class="stat-name">Number of characters</span>
      <Stepper bind:value={value.partySize} min={1} max={8} label="Number of characters" />
    </div>
    <div class="stat">
      <span class="stat-name">Average level</span>
      <Stepper bind:value={value.partyLevel} min={1} max={20} label="Average level" />
    </div>
  </fieldset>

  <fieldset class="setting">
    <legend>Setting</legend>
    <select
      bind:value={value.climate}
      class:unset={value.climate === ''}
      aria-label={FIELD.climate.label}
    >
      <option value="" disabled>{FIELD.climate.glyph} {FIELD.climate.label}…</option>
      {#each climates as c (c)}<option value={c}>{climateGlyph(c)} {c}</option>{/each}
    </select>
    <select
      bind:value={value.environment}
      class:unset={value.environment === ''}
      aria-label={FIELD.environment.label}
    >
      <option value="" disabled>{FIELD.environment.glyph} {FIELD.environment.label}…</option>
      {#each environments as e (e)}<option value={e}>{envGlyph(e)} {e}</option>{/each}
    </select>
    <select
      bind:value={value.season}
      class:unset={value.season === ''}
      aria-label={FIELD.season.label}
    >
      <option value="" disabled>{FIELD.season.glyph} {FIELD.season.label}…</option>
      {#each seasons as s (s)}<option value={s}>{g(s)} {s}</option>{/each}
    </select>
    <select bind:value={value.time} class:unset={value.time === ''} aria-label={FIELD.time.label}>
      <option value="" disabled>{FIELD.time.glyph} {FIELD.time.label}…</option>
      {#each times as t (t)}<option value={t}>{g(t)} {t}</option>{/each}
    </select>
    <select
      bind:value={value.region}
      class:unset={value.region === ''}
      aria-label={FIELD.region.label}
    >
      <option value="" disabled>{FIELD.region.glyph} {FIELD.region.label}…</option>
      {#each regions as r (r)}<option value={r}>{g(r)} {r}</option>{/each}
    </select>
  </fieldset>

  <fieldset class="state">
    <legend>Activity</legend>
    <div class="segmented" role="radiogroup" aria-label="Travel mode">
      <label class="seg" class:active={value.mode === 'Travelling'}>
        <input type="radio" bind:group={value.mode} value="Travelling" />
        <span class="seg-glyph seg-glyph-base" aria-hidden="true">🥾</span>
        <span class="seg-label seg-label-base">Travelling</span>
      </label>
      <label class="seg" class:active={value.mode === 'AtCamp'}>
        <input type="radio" bind:group={value.mode} value="AtCamp" />
        <span class="seg-glyph seg-glyph-base" aria-hidden="true">⛺</span>
        <span class="seg-label seg-label-base">At camp</span>
      </label>
    </div>
    <div class="state-extras">
      <label class="extra">
        <input type="checkbox" bind:checked={value.noise} />
        <span class="state-glyph" aria-hidden="true">📢</span> Making noise
      </label>
      <label class="extra">
        <input type="checkbox" bind:checked={value.campfire} disabled={value.mode !== 'AtCamp'} />
        <span class="state-glyph" aria-hidden="true">🔥</span> Campfire lit
      </label>
    </div>
  </fieldset>

  <button type="submit" class="roll" disabled={!canRoll}>Roll</button>
</form>

<style>
  .form {
    display: grid;
    gap: 1rem;
  }
  fieldset {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.1rem 1.1rem;
    display: grid;
    gap: 0.65rem;
    margin: 0;
  }
  legend {
    padding: 0 0.5rem;
    margin-left: 0.4rem;
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent);
  }
  label {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    color: var(--text-dim);
  }
  select.unset {
    color: var(--text-muted);
    font-style: italic;
  }
  fieldset.setting {
    gap: 0.55rem;
  }
  fieldset.setting select {
    text-align: center;
    text-align-last: center;
    padding-left: 2rem;
  }
  fieldset.setting option {
    text-align: left;
  }
  fieldset.party {
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  fieldset.party legend {
    grid-column: 1 / -1;
  }
  .stat {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.4rem;
    text-align: center;
  }
  .stat-name {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  fieldset.state {
    gap: 0;
  }
  fieldset.state legend {
    margin-bottom: 0.65rem;
  }
  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface-2);
  }
  .seg {
    /* Target: ~2/3 of Roll button height. Roll renders ~3.4rem; 2/3 ≈ 2.3rem. */
    min-height: 2.3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    color: var(--text-dim);
    font-size: 1rem;
    transition:
      background 140ms ease,
      color 140ms ease;
    user-select: none;
  }
  .seg-glyph {
    font-size: 1.1rem;
  }
  .seg-label {
    font-size: 0.82rem;
    letter-spacing: 0.2em;
  }
  .seg + .seg {
    border-left: 1px solid var(--border-strong);
  }
  .seg input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  .seg-glyph-base {
    line-height: 1;
  }
  .seg-label-base {
    font-family: var(--font-display);
    font-weight: 600;
    text-transform: uppercase;
  }
  .seg:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.03);
  }
  .seg.active {
    background: var(--accent);
    color: #1a1407;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.2) inset;
  }
  .seg.active + .seg,
  .seg:not(.active) + .seg.active {
    border-left-color: rgba(0, 0, 0, 0.35);
  }
  .state-extras {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    margin-top: 0.4rem;
  }
  .state-extras .extra {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.6rem 0.4rem;
    cursor: pointer;
    color: var(--text-dim);
    font-size: 0.88rem;
    white-space: nowrap;
  }
  .state-extras .extra:has(input:disabled) {
    cursor: not-allowed;
    color: var(--text-muted);
    opacity: 0.6;
  }
  .state-extras .extra input[type='checkbox'] {
    accent-color: var(--accent);
  }
  label:has(input[type='radio']),
  label:has(input[type='checkbox']) {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    padding: 0.25rem 0;
  }
  label:has(input[type='checkbox']:disabled) {
    cursor: not-allowed;
    color: var(--text-muted);
  }
  select {
    width: 100%;
    padding: 0.55rem 0.7rem;
    font: inherit;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    appearance: none;
    -webkit-appearance: none;
  }
  select {
    background-image:
      linear-gradient(45deg, transparent 50%, var(--text-dim) 50%),
      linear-gradient(135deg, var(--text-dim) 50%, transparent 50%);
    background-position:
      calc(100% - 17px) 55%,
      calc(100% - 12px) 55%;
    background-size:
      5px 5px,
      5px 5px;
    background-repeat: no-repeat;
    padding-right: 2rem;
  }
  select:hover {
    border-color: var(--accent-soft);
  }
  select:focus {
    border-color: var(--accent);
    outline: none;
  }
  option {
    background: var(--surface-2);
    color: var(--text);
  }
  input[type='checkbox'],
  input[type='radio'] {
    justify-self: start;
    width: 1.05rem;
    height: 1.05rem;
    accent-color: var(--accent);
    cursor: pointer;
  }
  input[type='checkbox']:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  button.roll {
    padding: 0.95rem 2rem;
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #1a1407;
    background: linear-gradient(180deg, var(--accent-strong) 0%, var(--accent) 100%);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 999px;
    cursor: pointer;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.25) inset,
      0 6px 18px -6px rgba(212, 164, 74, 0.55);
    transition:
      transform 80ms ease,
      box-shadow 120ms ease;
  }
  button.roll:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.35) inset,
      0 10px 22px -6px rgba(212, 164, 74, 0.7);
  }
  button.roll:active {
    transform: translateY(0);
  }
  button.roll:disabled {
    cursor: not-allowed;
    opacity: 0.4;
    transform: none;
    box-shadow: none;
  }
  @media (min-width: 640px) {
    .form {
      gap: 1.25rem;
    }
    button.roll {
      justify-self: center;
      min-width: 14rem;
    }
  }
  @media (max-width: 480px) {
    label {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }
  }
</style>
