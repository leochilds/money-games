<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  type SpeedOption = {
    value: string;
    label: string;
  };

  const dispatch = createEventDispatcher<{
    speedchange: string;
    reset: void;
  }>();

  let {
    speed = '1000',
    speedOptions = [
      { value: '2000', label: '0.5x (slow & steady)' },
      { value: '1000', label: '1x (default)' },
      { value: '500', label: '2x (fast)' },
      { value: '250', label: '4x (very fast)' }
    ] as SpeedOption[]
  } = $props();

  function handleSpeedChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    speed = value;
    dispatch('speedchange', value);
  }

  function handleReset() {
    dispatch('reset');
  }
</script>

<section class="col-12">
  <div class="card shadow-sm h-100">
    <div class="card-header bg-primary text-white">Simulation Settings</div>
    <div class="card-body">
      <p class="text-muted">
        Adjust how quickly in-game days progress and reset the game when you want to start again.
      </p>
      <div class="row g-3 align-items-end">
        <div class="col-12 col-md-6">
          <label for="speedControl" class="form-label">Game speed</label>
          <select id="speedControl" class="form-select" onchange={handleSpeedChange} bind:value={speed}>
            {#each speedOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>
        <div class="col-12 col-md-auto ms-md-auto">
          <button
            id="resetButton"
            class="btn btn-outline-danger w-100"
            type="button"
            onclick={handleReset}
          >
            Reset Game
          </button>
        </div>
      </div>
    </div>
  </div>
</section>
