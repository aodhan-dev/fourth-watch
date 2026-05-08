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

  let copyStatus = $state<'idle' | 'copied' | 'error'>('idle');
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  function copySeed() {
    if (!result) return;
    navigator.clipboard
      ?.writeText(String(result.seed))
      .then(() => {
        if (copyTimer) clearTimeout(copyTimer);
        copyStatus = 'copied';
        copyTimer = setTimeout(() => {
          copyStatus = 'idle';
        }, 2000);
      })
      .catch(() => {
        if (copyTimer) clearTimeout(copyTimer);
        copyStatus = 'error';
        copyTimer = setTimeout(() => {
          copyStatus = 'idle';
        }, 3000);
      });
  }
</script>

{#if result === null}
  <div class="empty">
    <p>Pick the scene above and roll the night.</p>
  </div>
{:else}
  <article class="panel">
    <WeatherBlock weather={result.weather} />
    <EncounterBlock encounter={result.encounter} message={result.encounterMessage} />
    <footer class="meta">
      <span class="seed" title="Seed determines this exact roll. Copy it to reproduce.">
        <span class="seed-label" id="seed-label">Seed</span>
        <code aria-describedby="seed-label">{result.seed}</code>
      </span>
      <button class="ghost copy-btn" onclick={copySeed} title="Copy seed">
        {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'error' ? 'Failed' : 'Copy'}
      </button>
      <span aria-live="polite" aria-atomic="true" class="copy-status">
        {copyStatus === 'copied'
          ? 'Seed copied to clipboard.'
          : copyStatus === 'error'
            ? 'Failed to copy seed.'
            : ''}
      </span>
      <span class="meta-spacer"></span>
      <button class="ghost" onclick={onRerollWeather}
        ><span aria-hidden="true">↻</span> Weather</button
      >
      <button class="ghost" onclick={onRerollEncounter}
        ><span aria-hidden="true">↻</span> Encounter</button
      >
      <button class="roll-again" onclick={onRerollAll}
        ><span aria-hidden="true">↻</span> Roll again</button
      >
    </footer>
  </article>
{/if}

<style>
  .panel {
    margin-top: 2rem;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    padding: 1.5rem 1.5rem 1rem;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.05) inset,
      0 14px 40px -16px rgba(0, 0, 0, 0.55);
    position: relative;
  }
  .panel::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 14px;
    pointer-events: none;
    background: linear-gradient(
      135deg,
      rgba(212, 164, 74, 0.35) 0%,
      transparent 35%,
      transparent 65%,
      rgba(212, 164, 74, 0.18) 100%
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    padding: 1px;
  }
  .empty {
    margin-top: 2rem;
    padding: 2.25rem 1.5rem;
    text-align: center;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 14px;
  }
  .empty p {
    margin: 0;
    font-size: 1rem;
    font-style: italic;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }
  .seed {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .seed-label {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .seed code {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.78rem;
    background: var(--surface-2);
    color: var(--text-dim);
    padding: 0.2rem 0.45rem;
    border-radius: 4px;
    border: 1px solid var(--border);
  }
  .meta-spacer {
    flex: 1;
  }
  button {
    padding: 0.55rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 999px;
    transition:
      color 120ms ease,
      background 120ms ease,
      border-color 120ms ease;
  }
  button.ghost {
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border-strong);
  }
  button.ghost:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--accent-soft);
  }
  button.roll-again {
    font-family: var(--font-display);
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #1a1407;
    background: linear-gradient(180deg, var(--accent-strong) 0%, var(--accent) 100%);
    border: 1px solid rgba(0, 0, 0, 0.2);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.25) inset,
      0 4px 12px -4px rgba(212, 164, 74, 0.55);
    transition:
      transform 80ms ease,
      box-shadow 120ms ease;
  }
  button.roll-again:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.35) inset,
      0 8px 18px -4px rgba(212, 164, 74, 0.7);
  }
  button.roll-again:active {
    transform: translateY(0);
  }
  .copy-status {
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
  @media (max-width: 480px) {
    .meta-spacer {
      display: none;
    }
  }
</style>
