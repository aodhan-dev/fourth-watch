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

  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdInterval: ReturnType<typeof setInterval> | null = null;

  function dec() {
    if (value > min) value = Math.max(min, value - 1);
  }
  function inc() {
    if (value < max) value = Math.min(max, value + 1);
  }

  function startHold(fn: () => void) {
    fn();
    holdTimer = setTimeout(() => {
      holdInterval = setInterval(fn, 80);
    }, 350);
  }

  function endHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdInterval) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
  }

  function handleInput(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isNaN(v) && Number.isFinite(v)) {
      value = Math.min(max, Math.max(min, v));
    }
  }
</script>

<div class="stepper" role="group" aria-label={label}>
  <button
    type="button"
    disabled={value <= min}
    aria-label="Decrease {label}"
    tabindex="0"
    onpointerdown={() => startHold(dec)}
    onpointerup={endHold}
    onpointerleave={endHold}>−</button
  >
  <input
    type="number"
    {min}
    {max}
    {value}
    oninput={handleInput}
    aria-label={label}
    aria-valuenow={value}
    aria-valuemin={min}
    aria-valuemax={max}
    class="value-input"
  />
  <button
    type="button"
    disabled={value >= max}
    aria-label="Increase {label}"
    tabindex="0"
    onpointerdown={() => startHold(inc)}
    onpointerup={endHold}
    onpointerleave={endHold}>+</button
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
    user-select: none;
    touch-action: none;
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
  .value-input {
    width: 100%;
    text-align: center;
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.04em;
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    font-family: inherit;
    /* Hide number input spinner arrows */
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .value-input::-webkit-outer-spin-button,
  .value-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
