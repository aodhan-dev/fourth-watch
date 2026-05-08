<script lang="ts">
  import type {
    Climate,
    Environment,
    Season,
    TimeOfDay,
    RegionType,
    TravelMode,
    EncounterMood
  } from '$lib/engine/types';
  import InputForm from '../../src/lib/components/InputForm.svelte';

  type FormValue = {
    climate: Climate | '';
    environment: Environment | '';
    season: Season | '';
    time: TimeOfDay | '';
    region: RegionType | '';
    partyLevel: number;
    partySize: number;
    mode: TravelMode;
    campfire: boolean;
    noise: boolean;
    mood: EncounterMood;
  };

  // Test wrapper. InputForm expects its bindable `value` prop to come from a
  // parent-owned $state proxy. @testing-library/svelte's render() takes plain
  // props, so without this harness Svelte 5 fires
  // binding_property_non_reactive warnings on every `bind:value={value.X}`.
  let { initial, onRoll, canRoll }: { initial: FormValue; onRoll: () => void; canRoll: boolean } =
    $props();
  // svelte-ignore state_referenced_locally
  // Intentional: the harness snapshots `initial` once at mount and owns the
  // mutable state from then on. Tests don't re-pass initial after render.
  let value = $state({ ...initial });
</script>

<InputForm bind:value {onRoll} {canRoll} />
