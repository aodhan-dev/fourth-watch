<script lang="ts">
  import type { WeatherEffect } from '$lib/engine/types';
  let { effect }: { effect: WeatherEffect } = $props();

  const severity: 'info' | 'warn' | 'danger' = (() => {
    if (effect.id === 'cold-exhaustion' || effect.id === 'heat-exhaustion') return 'danger';
    if (effect.id === 'travel-pace-half' || effect.id === 'ranged-disadvantage') return 'warn';
    return 'info';
  })();
</script>

<span
  class="chip"
  data-severity={severity}
  data-source={effect.source}
  title={effect.source === 'SRD' ? 'From SRD 5.2 (CC-BY 4.0)' : 'Original wording'}
>
  <span class="sev-prefix"
    >{severity === 'danger' ? 'Danger' : severity === 'warn' ? 'Warning' : 'Info'}:
  </span>{effect.text}
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 500;
    margin: 0.2rem;
    background: var(--info-bg);
    color: var(--info-fg);
    border: 1px solid rgba(255, 255, 255, 0.06);
    line-height: 1.3;
  }
  .chip[data-severity='warn'] {
    background: var(--warn-bg);
    color: var(--warn-fg);
  }
  .chip[data-severity='danger'] {
    background: var(--danger-bg);
    color: var(--danger-fg);
  }
  .sev-prefix {
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
  .chip[data-source='SRD']::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.55;
    flex-shrink: 0;
  }
</style>
