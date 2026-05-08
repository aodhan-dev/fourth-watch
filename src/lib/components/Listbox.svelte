<script lang="ts" generics="T extends string">
  // ARIA listbox/combobox pattern: focus stays on the button trigger,
  // active option tracked via aria-activedescendant. Keyboard: Up/Down/Home/End,
  // Enter/Space to select, Esc to close, Tab to close+leave, type-ahead jumps to
  // the first option starting with the buffer.

  let {
    value = $bindable('' as T | ''),
    options,
    triggerId,
    labelId,
    themeField,
    placeholder = 'Choose…'
  }: {
    value: T | '';
    options: readonly T[];
    triggerId: string;
    labelId: string;
    themeField?: string;
    placeholder?: string;
  } = $props();

  let open = $state(false);
  let activeIndex = $state(-1);
  let triggerEl: HTMLButtonElement | undefined = $state();
  let listEl: HTMLUListElement | undefined = $state();

  let typeahead = '';
  let typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

  let listboxId = $derived(`${triggerId}-listbox`);

  function openMenu(focusIndex = -1) {
    open = true;
    if (focusIndex >= 0) {
      activeIndex = focusIndex;
    } else {
      const i = value === '' ? -1 : options.indexOf(value);
      activeIndex = i >= 0 ? i : 0;
    }
  }

  function closeMenu() {
    open = false;
    activeIndex = -1;
    typeahead = '';
    if (typeaheadTimer) {
      clearTimeout(typeaheadTimer);
      typeaheadTimer = null;
    }
  }

  function selectAt(i: number) {
    if (i < 0 || i >= options.length) return;
    value = options[i];
    closeMenu();
    triggerEl?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu(options.length - 1);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        activeIndex = (activeIndex + 1) % options.length;
        break;
      case 'ArrowUp':
        e.preventDefault();
        activeIndex = (activeIndex - 1 + options.length) % options.length;
        break;
      case 'Home':
        e.preventDefault();
        activeIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        activeIndex = options.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0) selectAt(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu();
        triggerEl?.focus();
        break;
      case 'Tab':
        // Close but allow Tab to move focus normally.
        closeMenu();
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          typeahead += e.key.toLowerCase();
          if (typeaheadTimer) clearTimeout(typeaheadTimer);
          typeaheadTimer = setTimeout(() => (typeahead = ''), 500);
          const idx = options.findIndex((o) => o.toLowerCase().startsWith(typeahead));
          if (idx >= 0) activeIndex = idx;
        }
    }
  }

  $effect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!listEl?.contains(e.target as Node) && !triggerEl?.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  });

  $effect(() => {
    if (open && activeIndex >= 0 && listEl) {
      const item = listEl.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  });

  let activeId = $derived(activeIndex >= 0 ? `${triggerId}-option-${activeIndex}` : undefined);
</script>

<div class="listbox-wrap">
  <button
    bind:this={triggerEl}
    type="button"
    id={triggerId}
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={listboxId}
    aria-activedescendant={activeId}
    aria-labelledby={labelId}
    class="trigger"
    class:unset={value === ''}
    data-theme-field={themeField}
    data-value={value || undefined}
    onclick={() => (open ? closeMenu() : openMenu())}
    onkeydown={onKey}
  >
    <span class="trigger-text">{value || placeholder}</span>
    <span class="chevron" aria-hidden="true"></span>
  </button>
  {#if open}
    <ul bind:this={listEl} id={listboxId} role="listbox" tabindex="-1" class="listbox">
      {#each options as opt, i (opt)}
        <li
          id={`${triggerId}-option-${i}`}
          role="option"
          aria-selected={value === opt}
          class="option"
          class:active={activeIndex === i}
          data-theme-field={themeField}
          data-value={opt}
          onmousedown={(e) => {
            e.preventDefault();
            selectAt(i);
          }}
          onmouseenter={() => (activeIndex = i)}
        >
          {opt}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .listbox-wrap {
    position: relative;
  }
  .trigger {
    width: 100%;
    padding: 0.55rem 2rem 0.55rem 0.7rem;
    font: inherit;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    cursor: pointer;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    min-height: 2.4rem;
    transition:
      border-color 140ms ease,
      background 140ms ease;
  }
  .trigger.unset .trigger-text {
    color: var(--text-muted);
    font-style: italic;
  }
  .trigger:hover {
    border-color: var(--accent-soft);
  }
  .trigger:focus-visible {
    outline: 2px solid var(--accent-strong);
    outline-offset: 2px;
    border-color: var(--accent);
  }
  .chevron {
    position: absolute;
    right: 0.85rem;
    top: 50%;
    width: 0.5rem;
    height: 0.5rem;
    transform: translateY(-65%) rotate(45deg);
    border-right: 2px solid var(--text-dim);
    border-bottom: 2px solid var(--text-dim);
    pointer-events: none;
    transition: transform 140ms ease;
  }
  .trigger[aria-expanded='true'] .chevron {
    transform: translateY(-25%) rotate(-135deg);
  }

  .listbox {
    list-style: none;
    position: absolute;
    top: calc(100% + 0.3rem);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0.3rem;
    background: var(--surface-3);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 12px 28px -10px rgba(0, 0, 0, 0.7);
    max-height: 17rem;
    overflow-y: auto;
    z-index: 20;
  }
  .option {
    padding: 0.55rem 0.7rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text);
    font-size: 0.95rem;
    transition: background 100ms ease;
  }
  .option.active {
    background: rgba(255, 255, 255, 0.06);
  }
  .option[aria-selected='true'] {
    color: var(--accent-strong);
    font-weight: 600;
  }

  /* Per-value tint, applied via --tint set below. Options get a left stripe;
     the trigger gets a tinted gradient and accent border. color-mix in sRGB
     keeps hue identity stable: oklch mixing pulls orange-on-deep-blue toward
     purple, which loses the field's signal. */
  .trigger[data-theme-field][data-value] {
    background:
      linear-gradient(
          90deg,
          color-mix(in srgb, var(--tint) 30%, transparent) 0%,
          transparent 70%
        )
        var(--surface-2);
    border-color: color-mix(in srgb, var(--tint) 55%, var(--border-strong));
  }
  .trigger[data-theme-field][data-value]:hover {
    border-color: color-mix(in srgb, var(--tint) 75%, var(--border-strong));
  }
  .option[data-theme-field][data-value] {
    border-left: 3px solid var(--tint);
    padding-left: calc(0.7rem - 3px);
  }

  /* Climate */
  .trigger[data-theme-field='climate'][data-value='Tropical'],
  .option[data-theme-field='climate'][data-value='Tropical'] {
    --tint: #2fb47a;
  }
  .trigger[data-theme-field='climate'][data-value='Subtropical'],
  .option[data-theme-field='climate'][data-value='Subtropical'] {
    --tint: #6fbf73;
  }
  .trigger[data-theme-field='climate'][data-value='Arid'],
  .option[data-theme-field='climate'][data-value='Arid'] {
    --tint: #d29a3a;
  }
  .trigger[data-theme-field='climate'][data-value='Temperate'],
  .option[data-theme-field='climate'][data-value='Temperate'] {
    --tint: #5fa3b4;
  }
  .trigger[data-theme-field='climate'][data-value='Subarctic'],
  .option[data-theme-field='climate'][data-value='Subarctic'] {
    --tint: #8aa6c0;
  }
  .trigger[data-theme-field='climate'][data-value='Arctic'],
  .option[data-theme-field='climate'][data-value='Arctic'] {
    --tint: #b0d6e8;
  }

  /* Environment */
  .trigger[data-theme-field='environment'][data-value='Arctic'],
  .option[data-theme-field='environment'][data-value='Arctic'] {
    --tint: #b0d6e8;
  }
  .trigger[data-theme-field='environment'][data-value='Coastal'],
  .option[data-theme-field='environment'][data-value='Coastal'] {
    --tint: #4ea3c8;
  }
  .trigger[data-theme-field='environment'][data-value='Desert'],
  .option[data-theme-field='environment'][data-value='Desert'] {
    --tint: #d6a85c;
  }
  .trigger[data-theme-field='environment'][data-value='Forest'],
  .option[data-theme-field='environment'][data-value='Forest'] {
    --tint: #4a8f4e;
  }
  .trigger[data-theme-field='environment'][data-value='Grassland'],
  .option[data-theme-field='environment'][data-value='Grassland'] {
    --tint: #9cbf3a;
  }
  .trigger[data-theme-field='environment'][data-value='Hills'],
  .option[data-theme-field='environment'][data-value='Hills'] {
    --tint: #a39548;
  }
  .trigger[data-theme-field='environment'][data-value='Mountains'],
  .option[data-theme-field='environment'][data-value='Mountains'] {
    --tint: #8a8d92;
  }
  .trigger[data-theme-field='environment'][data-value='Swamp'],
  .option[data-theme-field='environment'][data-value='Swamp'] {
    --tint: #6b8a4a;
  }
  .trigger[data-theme-field='environment'][data-value='Underground'],
  .option[data-theme-field='environment'][data-value='Underground'] {
    --tint: #6a5e76;
  }
  .trigger[data-theme-field='environment'][data-value='Urban'],
  .option[data-theme-field='environment'][data-value='Urban'] {
    --tint: #b09a7f;
  }
  .trigger[data-theme-field='environment'][data-value='Wasteland'],
  .option[data-theme-field='environment'][data-value='Wasteland'] {
    --tint: #8a6b50;
  }

  /* Season */
  .trigger[data-theme-field='season'][data-value='Spring'],
  .option[data-theme-field='season'][data-value='Spring'] {
    --tint: #a3d96b;
  }
  .trigger[data-theme-field='season'][data-value='Summer'],
  .option[data-theme-field='season'][data-value='Summer'] {
    --tint: #f0c272;
  }
  .trigger[data-theme-field='season'][data-value='Autumn'],
  .option[data-theme-field='season'][data-value='Autumn'] {
    --tint: #d4783a;
  }
  .trigger[data-theme-field='season'][data-value='Winter'],
  .option[data-theme-field='season'][data-value='Winter'] {
    --tint: #b0d6e8;
  }

  /* Region */
  .trigger[data-theme-field='region'][data-value='Settled'],
  .option[data-theme-field='region'][data-value='Settled'] {
    --tint: #b88a4d;
  }
  .trigger[data-theme-field='region'][data-value='Frontier'],
  .option[data-theme-field='region'][data-value='Frontier'] {
    --tint: #c98a3a;
  }
  .trigger[data-theme-field='region'][data-value='Wilderness'],
  .option[data-theme-field='region'][data-value='Wilderness'] {
    --tint: #3e7a4d;
  }
  .trigger[data-theme-field='region'][data-value='Hostile'],
  .option[data-theme-field='region'][data-value='Hostile'] {
    --tint: #a8453d;
  }

  /* Time of day */
  .trigger[data-theme-field='time'][data-value='Dawn'],
  .option[data-theme-field='time'][data-value='Dawn'] {
    --tint: #f0a988;
  }
  .trigger[data-theme-field='time'][data-value='Day'],
  .option[data-theme-field='time'][data-value='Day'] {
    --tint: #f0c272;
  }
  .trigger[data-theme-field='time'][data-value='Dusk'],
  .option[data-theme-field='time'][data-value='Dusk'] {
    --tint: #b07cb4;
  }
  .trigger[data-theme-field='time'][data-value='Night'],
  .option[data-theme-field='time'][data-value='Night'] {
    --tint: #4a6aa3;
  }
</style>
