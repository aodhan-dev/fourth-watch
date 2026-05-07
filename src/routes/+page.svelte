<script lang="ts">
  import { onMount } from 'svelte';
  import InputForm from '$lib/components/InputForm.svelte';
  import ResultPanel from '$lib/components/ResultPanel.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { roll } from '$lib/engine';
  import type { Inputs, RollResult } from '$lib/engine/types';

  const STORAGE_KEY = 'fourth-watch-inputs-v1';

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
  <title>Fourth Watch — D&amp;D weather & encounters</title>
</svelte:head>

<main>
  <header class="title">
    <h1>Fourth Watch</h1>
    <p class="tagline">D&amp;D weather & wandering encounters</p>
  </header>
  <InputForm bind:value={inputs} onRoll={rollAll} />
  <div aria-live="polite" aria-atomic="true">
    <ResultPanel
      {result}
      onRerollAll={rollAll}
      onRerollWeather={rerollWeather}
      onRerollEncounter={rerollEncounter}
    />
  </div>
  <Footer />
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }
  .title {
    margin: 0.5rem 0 1.25rem;
  }
  h1 {
    font-size: 1.75rem;
    margin: 0;
    letter-spacing: 0.01em;
  }
  .tagline {
    margin: 0.15rem 0 0;
    font-size: 0.95rem;
    color: #666;
  }
</style>
