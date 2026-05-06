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
      >Climate
      <select bind:value={value.climate}>
        {#each climates as c (c)}<option value={c}>{c}</option>{/each}
      </select>
    </label>
    <label
      >Environment
      <select bind:value={value.environment}>
        {#each environments as e (e)}<option value={e}>{e}</option>{/each}
      </select>
    </label>
    <label
      >Season
      <select bind:value={value.season}>
        {#each seasons as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    </label>
    <label
      >Time of day
      <select bind:value={value.time}>
        {#each times as t (t)}<option value={t}>{t}</option>{/each}
      </select>
    </label>
    <label
      >Region type
      <select bind:value={value.region}>
        {#each regions as r (r)}<option value={r}>{r}</option>{/each}
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
