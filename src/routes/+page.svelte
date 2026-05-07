<script lang="ts">
  import { onMount } from 'svelte';
  import InputForm from '$lib/components/InputForm.svelte';
  import ResultPanel from '$lib/components/ResultPanel.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { roll } from '$lib/engine';
  import type {
    Inputs,
    RollResult,
    Climate,
    Environment,
    Season,
    TimeOfDay,
    RegionType
  } from '$lib/engine/types';

  const STORAGE_KEY = 'fourth-watch-inputs-v2';

  // Form state allows enum fields to start unset ('' sentinel) so each dropdown
  // shows its field name as placeholder on first visit. Once chosen, persisted
  // in localStorage. Numeric/boolean fields keep their sensible defaults.
  type FormState = {
    climate: Climate | '';
    environment: Environment | '';
    season: Season | '';
    time: TimeOfDay | '';
    region: RegionType | '';
    partyLevel: number;
    partySize: number;
    mode: Inputs['mode'];
    campfire: boolean;
    noise: boolean;
  };

  const defaultForm: FormState = {
    climate: '',
    environment: '',
    season: '',
    time: '',
    region: '',
    partyLevel: 3,
    partySize: 4,
    mode: 'Travelling',
    campfire: false,
    noise: false
  };

  let inputs = $state<FormState>({ ...defaultForm });
  let result = $state<RollResult | null>(null);

  function isComplete(f: FormState): f is FormState & Inputs {
    return (
      f.climate !== '' &&
      f.environment !== '' &&
      f.season !== '' &&
      f.time !== '' &&
      f.region !== ''
    );
  }

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

  function snapshot(): Inputs | null {
    const snap = $state.snapshot(inputs) as FormState;
    if (!isComplete(snap)) return null;
    return snap;
  }

  function rollAll() {
    const snap = snapshot();
    if (!snap) return;
    persist();
    result = roll(snap, newSeed());
  }

  function rerollWeather() {
    if (!result) return rollAll();
    const snap = snapshot();
    if (!snap) return;
    result = roll(snap, result.seed, { rerollWeather: newSeed() });
  }

  function rerollEncounter() {
    if (!result) return rollAll();
    const snap = snapshot();
    if (!snap) return;
    result = roll(snap, result.seed, { rerollEncounter: newSeed() });
  }
</script>

<svelte:head>
  <title>Fourth Watch — D&amp;D weather & encounters</title>
</svelte:head>

<main>
  <header class="title">
    <h1>Fourth Watch</h1>
    <p class="tagline">D&amp;D weather and wandering encounters, rolled at the table.</p>
  </header>
  <InputForm bind:value={inputs} onRoll={rollAll} canRoll={isComplete(inputs)} />
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
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }
  .title {
    margin: 0.5rem 0 2rem;
    text-align: center;
  }
  h1 {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: clamp(2.4rem, 6vw, 3.4rem);
    line-height: 1;
    margin: 0;
    letter-spacing: 0.04em;
    color: var(--text);
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
  }
  .tagline {
    margin: 0.75rem auto 0;
    max-width: 32ch;
    font-size: 0.95rem;
    color: var(--text-dim);
  }
</style>
