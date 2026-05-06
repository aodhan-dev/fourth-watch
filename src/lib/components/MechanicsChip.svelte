<script lang="ts">
  import type { WeatherEffect } from '$lib/engine/types';
  let { effect }: { effect: WeatherEffect } = $props();
</script>

<span
  class="chip"
  title={effect.source === 'SRD' ? 'From SRD 5.2 (CC-BY 4.0)' : 'Original wording'}
>
  {effect.text}
</span>

<style>
  .chip {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 1rem;
    background: #eee;
    font-size: 0.85rem;
    margin: 0.2rem;
  }
</style>
