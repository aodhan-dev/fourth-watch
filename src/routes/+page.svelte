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
