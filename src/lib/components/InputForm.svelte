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
  import Listbox from './Listbox.svelte';

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

  const FIELD = {
    climate: { label: 'Climate', id: 'sel-climate', labelId: 'lbl-climate' },
    environment: { label: 'Environment', id: 'sel-environment', labelId: 'lbl-environment' },
    season: { label: 'Season', id: 'sel-season', labelId: 'lbl-season' },
    time: { label: 'Time of day', id: 'sel-time', labelId: 'lbl-time' },
    region: { label: 'Region', id: 'sel-region', labelId: 'lbl-region' }
  } as const;

  const FIELD_KEYS = ['climate', 'environment', 'season', 'time', 'region'] as const;
  const FIELD_LABELS: Record<(typeof FIELD_KEYS)[number], string> = {
    climate: 'climate',
    environment: 'environment',
    season: 'season',
    time: 'time of day',
    region: 'region'
  };

  let missingFields = $derived(
    FIELD_KEYS.filter((k) => value[k] === '').map((k) => FIELD_LABELS[k])
  );
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
    <div class="field">
      <label class="field-label" id={FIELD.climate.labelId} for={FIELD.climate.id}>
        {FIELD.climate.label}
      </label>
      <Listbox
        bind:value={value.climate}
        options={climates}
        triggerId={FIELD.climate.id}
        labelId={FIELD.climate.labelId}
        themeField="climate"
      />
    </div>
    <div class="field">
      <label class="field-label" id={FIELD.environment.labelId} for={FIELD.environment.id}>
        {FIELD.environment.label}
      </label>
      <Listbox
        bind:value={value.environment}
        options={environments}
        triggerId={FIELD.environment.id}
        labelId={FIELD.environment.labelId}
        themeField="environment"
      />
    </div>
    <div class="field">
      <label class="field-label" id={FIELD.season.labelId} for={FIELD.season.id}>
        {FIELD.season.label}
      </label>
      <Listbox
        bind:value={value.season}
        options={seasons}
        triggerId={FIELD.season.id}
        labelId={FIELD.season.labelId}
        themeField="season"
      />
    </div>
    <div class="field">
      <label class="field-label" id={FIELD.time.labelId} for={FIELD.time.id}>
        {FIELD.time.label}
      </label>
      <Listbox
        bind:value={value.time}
        options={times}
        triggerId={FIELD.time.id}
        labelId={FIELD.time.labelId}
        themeField="time"
      />
    </div>
    <div class="field">
      <label class="field-label" id={FIELD.region.labelId} for={FIELD.region.id}>
        {FIELD.region.label}
      </label>
      <Listbox
        bind:value={value.region}
        options={regions}
        triggerId={FIELD.region.id}
        labelId={FIELD.region.labelId}
        themeField="region"
      />
    </div>
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
      <label class="pad noise" class:on={value.noise}>
        <input type="checkbox" bind:checked={value.noise} />
        <span class="pad-glyph" aria-hidden="true">📢</span>
        <span class="pad-label">Making noise</span>
      </label>
      <label
        class="pad fire"
        class:on={value.campfire}
        class:disabled={value.mode !== 'AtCamp'}
        aria-disabled={value.mode !== 'AtCamp' ? 'true' : undefined}
      >
        <input type="checkbox" bind:checked={value.campfire} disabled={value.mode !== 'AtCamp'} />
        <span class="pad-glyph" aria-hidden="true">🔥</span>
        <span class="pad-label">Campfire lit</span>
        {#if value.mode !== 'AtCamp'}
          <span class="pad-unlock">(unlocks at camp)</span>
        {/if}
      </label>
    </div>
  </fieldset>

  <button type="submit" class="roll" disabled={!canRoll}>Roll</button>
  {#if !canRoll && missingFields.length > 0}
    <p class="roll-hint">Pick a {missingFields.join(', ')} to roll.</p>
  {/if}
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
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--accent);
  }
  label {
    font-size: 0.95rem;
    color: var(--text-dim);
  }
  fieldset.setting {
    gap: 0.45rem;
  }
  .field {
    display: grid;
    gap: 0.25rem;
  }
  .field-label {
    display: block;
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    padding-left: 0.1rem;
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
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--text-dim);
  }
  fieldset.state {
    gap: 0.55rem;
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
    /* 44pt touch target per WCAG 2.5.5 */
    min-height: 2.75rem;
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
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border-width: 0;
  }
  .seg:focus-within {
    outline: 2px solid var(--accent-strong);
    outline-offset: 2px;
  }
  .seg-glyph-base {
    line-height: 1;
  }
  .seg-label-base {
    font-family: var(--font-display);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
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
    gap: 0.55rem;
  }
  .pad {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    padding: 0.85rem 0.75rem;
    min-height: 2.75rem;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    cursor: pointer;
    color: var(--text-dim);
    user-select: none;
    white-space: nowrap;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease,
      box-shadow 140ms ease;
  }
  .pad input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border-width: 0;
  }
  .pad:focus-within {
    outline: 2px solid var(--accent-strong);
    outline-offset: 2px;
  }
  .pad-glyph {
    font-size: 1.05rem;
    line-height: 1;
  }
  .pad-label {
    font-size: 0.85rem;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .pad.on .pad-label {
    font-weight: 600;
  }
  .pad:hover:not(.disabled) {
    border-color: rgba(255, 255, 255, 0.25);
    color: var(--text);
  }
  .pad.noise.on {
    background: rgba(196, 75, 107, 0.16);
    border-color: rgba(196, 75, 107, 0.65);
    color: #f3b6c0;
    box-shadow:
      inset 0 0 0 1px rgba(196, 75, 107, 0.35),
      0 0 16px -4px rgba(196, 75, 107, 0.45);
  }
  .pad.fire.on {
    background: rgba(224, 123, 58, 0.16);
    border-color: rgba(224, 123, 58, 0.7);
    color: #f3c89a;
    box-shadow:
      inset 0 0 0 1px rgba(224, 123, 58, 0.4),
      0 0 16px -4px rgba(224, 123, 58, 0.55);
  }
  .pad.disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
  .pad-unlock {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 0.15rem;
    width: 100%;
    text-align: center;
    line-height: 1.2;
  }
  .roll-hint {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-muted);
    text-align: center;
    font-style: italic;
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
  @media (max-width: 639px) {
    button.roll {
      width: 100%;
    }
  }
</style>
