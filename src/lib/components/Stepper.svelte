<script lang="ts">
  let {
    value = $bindable(),
    min = 1,
    max = 99,
    label
  }: {
    value: number;
    min?: number;
    max?: number;
    label: string;
  } = $props();

  function dec() {
    if (value > min) value -= 1;
  }
  function inc() {
    if (value < max) value += 1;
  }
</script>

<div class="stepper" role="group" aria-label={label}>
  <button
    type="button"
    onclick={dec}
    disabled={value <= min}
    aria-label="Decrease {label}"
    tabindex="0">−</button
  >
  <span class="value" aria-live="polite">{value}</span>
  <button
    type="button"
    onclick={inc}
    disabled={value >= max}
    aria-label="Increase {label}"
    tabindex="0">+</button
  >
</div>

<style>
  .stepper {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    overflow: hidden;
  }
  .stepper button {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-family: inherit;
    font-size: 1.5rem;
    font-weight: 400;
    line-height: 1;
    width: 3rem;
    height: 3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  .stepper button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: var(--accent);
  }
  .stepper button:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
  .stepper button:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }
  .value {
    text-align: center;
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.04em;
    user-select: none;
  }
</style>
