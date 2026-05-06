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
    margin-bottom: 1rem;
  }
  .narrative {
    font-size: 1.05rem;
  }
  .chips {
    margin-top: 0.5rem;
  }
</style>
