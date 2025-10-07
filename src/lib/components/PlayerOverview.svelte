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
    currentDay = 1,
    isPaused = false,
    balanceLabel = '',
    centralBankRateLabel = '',
    speed = '1000',
    speedOptions = [
      { value: '2000', label: '0.5x (slow & steady)' },
      { value: '1000', label: '1x (default)' },
      { value: '500', label: '2x (fast)' },
      { value: '250', label: '4x (very fast)' }
    ] as SpeedOption[],
    monthlyCashFlowLabel = '0'
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

<section class="col-12 col-lg-4">
  <div class="card shadow-sm h-100">
    <div class="card-header bg-success text-white">Player Overview</div>
    <div class="card-body">
      <p class="lead">
        Current Day:
        <span id="currentDay">{currentDay}</span>
        <span
          id="gamePausedBadge"
          class={`badge bg-warning text-dark ms-2${isPaused ? '' : ' d-none'}`}
        >
          Paused
        </span>
      </p>
      <p class="lead">
        Balance: <span id="playerBalance" class="fw-bold text-success">{balanceLabel}</span>
      </p>
      <p class="mb-3 text-muted">
        Central bank base rate:
        <span id="centralBankRate" class="fw-semibold">{centralBankRateLabel}</span>
      </p>
      <div class="mb-3">
        <label for="speedControl" class="form-label">Game speed</label>
        <select id="speedControl" class="form-select" onchange={handleSpeedChange} bind:value={speed}>
          {#each speedOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      <button id="resetButton" class="btn btn-outline-danger w-100" type="button" onclick={handleReset}>
        Reset Game
      </button>
    </div>
    <div class="card-footer text-muted">
      Monthly cash flow: <span id="rentPerMonth">{monthlyCashFlowLabel}</span>
    </div>
  </div>
</section>
