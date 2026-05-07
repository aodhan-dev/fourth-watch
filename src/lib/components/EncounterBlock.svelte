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
    margin-bottom: 0;
  }
  h2 {
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 0.5rem;
  }
  .lead {
    font-size: 1.2rem;
    line-height: 1.45;
    color: var(--text);
    margin: 0;
  }
  .expand {
    margin-top: 0.85rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.85rem;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    cursor: pointer;
    transition:
      color 120ms ease,
      border-color 120ms ease;
  }
  .expand:hover {
    color: var(--text);
    border-color: var(--accent-soft);
  }
  .stats {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.4rem 1.25rem;
    margin: 0.85rem 0 0;
    padding: 0.9rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.92rem;
  }
  dt {
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
    align-self: center;
  }
  dd {
    margin: 0;
    color: var(--text);
  }
  .quiet {
    font-style: italic;
    color: var(--text-muted);
    margin: 0;
    font-size: 1.05rem;
  }
</style>
