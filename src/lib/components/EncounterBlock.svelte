<script lang="ts">
  import type { Encounter } from '$lib/engine/types';
  let { encounter, message }: { encounter: Encounter | null; message: string | null } = $props();
  let expanded = $state(false);
</script>

<section class="encounter">
  <h2>Encounter</h2>
  {#if encounter === null}
    <p class="quiet">{message ?? 'The road is quiet.'}</p>
  {:else}
    <p class="lead">{encounter.narrative}</p>
    <button class="expand" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
      {expanded ? 'Hide' : 'Show'} stat block
    </button>
    {#if expanded}
      <dl class="stats">
        <dt>CR</dt>
        <dd>{encounter.creature.cr}</dd>
        <dt>Type</dt>
        <dd>{encounter.creature.type}</dd>
        <dt>Size</dt>
        <dd>{encounter.creature.size}</dd>
        <dt>HP</dt>
        <dd>{encounter.creature.hp}</dd>
        <dt>AC</dt>
        <dd>{encounter.creature.ac}</dd>
        <dt>Speed</dt>
        <dd>{encounter.creature.speed}</dd>
      </dl>
    {/if}
  {/if}
</section>

<style>
  .encounter {
    margin-bottom: 1rem;
  }
  .lead {
    font-size: 1.05rem;
  }
  .expand {
    margin-top: 0.5rem;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
  .stats {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin-top: 0.5rem;
  }
  dt {
    font-weight: 600;
  }
  .quiet {
    font-style: italic;
    color: #555;
  }
</style>
