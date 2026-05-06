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
      <button onclick={copySeed}>Copy</button>
      <button onclick={onRerollWeather}>Re-roll weather</button>
      <button onclick={onRerollEncounter}>Re-roll encounter</button>
      <button onclick={onRerollAll} class="primary">Re-roll all</button>
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
