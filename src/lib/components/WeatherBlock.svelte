<script lang="ts">
  import type { Weather } from '$lib/engine/types';
  import MechanicsChip from './MechanicsChip.svelte';
  let { weather }: { weather: Weather } = $props();
</script>

<section class="weather">
  <h2>Weather</h2>
  <p class="narrative">{weather.narrative}</p>
  {#if weather.effects.length > 0}
    <div class="chips" aria-label="Weather effects">
      {#each weather.effects as e (e.id)}
        <MechanicsChip effect={e} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .weather {
    padding-bottom: 1.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  h2 {
    font-family: var(--font-body);
    font-variant-caps: all-small-caps;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    color: var(--accent);
    margin: 0 0 0.5rem;
  }
  .narrative {
    font-size: 1.15rem;
    line-height: 1.45;
    color: var(--text);
    margin: 0;
  }
  .chips {
    margin: 0.85rem -0.2rem 0;
  }
</style>
