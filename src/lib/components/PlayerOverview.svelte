<script lang="ts">
  let {
    currentDay = 1,
    isPaused = false,
    balanceLabel = '',
    centralBankRateLabel = '',
    monthlyCashFlowLabel = '0'
  } = $props();
</script>

<section class="col-12">
  <div class="card shadow-sm h-100">
    <div class="card-header bg-success text-white">Game Snapshot</div>
    <div class="card-body">
      <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
        <div class="col">
          <p class="text-muted mb-1">Current Day</p>
          <p class="h4 mb-0 d-flex align-items-center gap-2">
            <span id="currentDay">{currentDay}</span>
            <span
              id="gamePausedBadge"
              class="badge bg-warning text-dark"
              class:d-none={!isPaused}
            >
              Paused
            </span>
          </p>
        </div>
        <div class="col">
          <p class="text-muted mb-1">Portfolio Balance</p>
          <p class="h4 mb-0 text-success" id="playerBalance">{balanceLabel}</p>
        </div>
        <div class="col">
          <p class="text-muted mb-1">Central Bank Base Rate</p>
          <p class="h4 mb-0" id="centralBankRate">{centralBankRateLabel}</p>
        </div>
      </div>
    </div>
    <div class="card-footer text-muted">
      Monthly cash flow:
      <span id="rentPerMonth">{@html monthlyCashFlowLabel}</span>
    </div>
  </div>
</section>
