<script lang="ts">
  import type {
    Climate,
    Environment,
    Season,
    TimeOfDay,
    RegionType,
    TravelMode
  } from '$lib/engine/types';

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
  <fieldset>
    <legend>Setting</legend>
    <label
      ><span class="field-label"><span class="field-glyph">{FIELD.climate.glyph}</span>Climate</span
      >
      <select bind:value={value.climate} class:unset={value.climate === ''}>
        <option value="" disabled>{FIELD.climate.glyph} {FIELD.climate.label}…</option>
        {#each climates as c (c)}<option value={c}>{climateGlyph(c)} {c}</option>{/each}
      </select>
    </label>
    <label
      ><span class="field-label"
        ><span class="field-glyph">{FIELD.environment.glyph}</span>Environment</span
      >
      <select bind:value={value.environment} class:unset={value.environment === ''}>
        <option value="" disabled>{FIELD.environment.glyph} {FIELD.environment.label}…</option>
        {#each environments as e (e)}<option value={e}>{envGlyph(e)} {e}</option>{/each}
      </select>
    </label>
    <label
      ><span class="field-label"><span class="field-glyph">{FIELD.season.glyph}</span>Season</span>
      <select bind:value={value.season} class:unset={value.season === ''}>
        <option value="" disabled>{FIELD.season.glyph} {FIELD.season.label}…</option>
        {#each seasons as s (s)}<option value={s}>{g(s)} {s}</option>{/each}
      </select>
    </label>
    <label
      ><span class="field-label"
        ><span class="field-glyph">{FIELD.time.glyph}</span>Time of day</span
      >
      <select bind:value={value.time} class:unset={value.time === ''}>
        <option value="" disabled>{FIELD.time.glyph} {FIELD.time.label}…</option>
        {#each times as t (t)}<option value={t}>{g(t)} {t}</option>{/each}
      </select>
    </label>
    <label
      ><span class="field-label"><span class="field-glyph">{FIELD.region.glyph}</span>Region</span>
      <select bind:value={value.region} class:unset={value.region === ''}>
        <option value="" disabled>{FIELD.region.glyph} {FIELD.region.label}…</option>
        {#each regions as r (r)}<option value={r}>{g(r)} {r}</option>{/each}
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
    <label
      ><input type="radio" bind:group={value.mode} value="Travelling" />
      <span class="state-glyph" aria-hidden="true">🥾</span> Travelling</label
    >
    <label
      ><input type="radio" bind:group={value.mode} value="AtCamp" />
      <span class="state-glyph" aria-hidden="true">⛺</span> At camp</label
    >
    <label
      ><input type="checkbox" bind:checked={value.campfire} disabled={value.mode !== 'AtCamp'} />
      <span class="state-glyph" aria-hidden="true">🔥</span> Campfire lit</label
    >
    <label
      ><input type="checkbox" bind:checked={value.noise} />
      <span class="state-glyph" aria-hidden="true">📢</span> Making noise</label
    >
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
  .field-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .field-glyph {
    font-size: 0.95rem;
    line-height: 1;
    opacity: 0.85;
  }
  select.unset {
    color: var(--text-muted);
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
  select,
  input[type='number'] {
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
  select:hover,
  input[type='number']:hover {
    border-color: var(--accent-soft);
  }
  select:focus,
  input[type='number']:focus {
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
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
    fieldset:first-of-type {
      grid-column: 1 / -1;
    }
    button.roll {
      grid-column: 1 / -1;
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
