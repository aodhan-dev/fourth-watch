<script lang="ts">
  import { onMount } from 'svelte';
  import InputForm from '$lib/components/InputForm.svelte';
  import ResultPanel from '$lib/components/ResultPanel.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { roll, parseMonsterCatalog } from '$lib/engine';
  import { validateFormState, type FormState } from '$lib/storage';
  import { newSeed } from '$lib/seed';
  import type { RollResult, Monster } from '$lib/engine/types';

  const STORAGE_KEY = 'fourth-watch-inputs-v2';
  const LEGACY_KEY = 'fourth-watch-inputs-v1';

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
  let loadedMonsters = $state<Monster[]>([]);

  function isComplete(f: FormState): f is FormState & import('$lib/engine/types').Inputs {
    return (
      f.climate !== '' &&
      f.environment !== '' &&
      f.season !== '' &&
      f.time !== '' &&
      f.region !== ''
    );
  }

  let canRoll = $derived(isComplete(inputs));

  $effect(() => {
    if (inputs.mode !== 'AtCamp' && inputs.campfire) {
      inputs.campfire = false;
    }
  });

  onMount(async () => {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const validated = validateFormState(JSON.parse(raw));
        if (validated) Object.assign(inputs, validated);
      }
    } catch {
      // ignore parse errors; fall back to defaults
    }
    const { default: catalogRaw } = await import('$lib/data/monsters.json');
    loadedMonsters = parseMonsterCatalog(catalogRaw as unknown);
  });

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      // localStorage unavailable; harmless
    }
  }

  function snapshot(): import('$lib/engine/types').Inputs | null {
    const snap = $state.snapshot(inputs) as FormState;
    if (!isComplete(snap)) return null;
    return snap;
  }

  function rollAll() {
    const snap = snapshot();
    if (!snap) return;
    persist();
    result = roll(snap, newSeed(), {}, loadedMonsters);
  }

  function rerollWeather() {
    if (!result) return rollAll();
    const snap = snapshot();
    if (!snap) return;
    result = roll(snap, result.seed, { rerollWeather: newSeed() }, loadedMonsters);
  }

  function rerollEncounter() {
    if (!result) return rollAll();
    const snap = snapshot();
    if (!snap) return;
    result = roll(snap, result.seed, { rerollEncounter: newSeed() }, loadedMonsters);
  }
</script>

<svelte:head>
  <title>Fourth Watch: D&amp;D weather &amp; encounters</title>
</svelte:head>

<main>
  <header class="title">
    <h1>Fourth Watch</h1>
    <p class="tagline">D&amp;D weather and wandering encounters, rolled at the table.</p>
  </header>
  <InputForm bind:value={inputs} onRoll={rollAll} {canRoll} />
  <p class="sr-status" aria-live="polite" aria-atomic="true">
    {result ? `Roll complete. Seed ${result.seed}.` : ''}
  </p>
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
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }
  .sr-status {
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
