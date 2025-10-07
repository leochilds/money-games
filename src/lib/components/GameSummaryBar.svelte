<script lang="ts">
  let {
    currentDay = 1,
    balanceLabel = '',
    centralBankRateLabel = ''
  } = $props();
</script>

<section class="mb-4" aria-label="Game summary">
  <div class="row g-3">
    <div class="col-12 col-md-4">
      <div class="card shadow-sm h-100 summary-card">
        <div class="card-body">
          <p class="text-uppercase text-muted fw-semibold mb-1 small">Current Day</p>
          <p class="h3 mb-0" id="summaryCurrentDay">{currentDay}</p>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-4">
      <div class="card shadow-sm h-100 summary-card">
        <div class="card-body">
          <p class="text-uppercase text-muted fw-semibold mb-1 small">Game Balance</p>
          <p class="h3 mb-0 text-success" id="summaryPlayerBalance">{balanceLabel}</p>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-4">
      <div class="card shadow-sm h-100 summary-card">
        <div class="card-body">
          <p class="text-uppercase text-muted fw-semibold mb-1 small">Central Bank Rate</p>
          <p class="h3 mb-0" id="summaryCentralBankRate">{centralBankRateLabel}</p>
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .summary-card {
    border: none;
    background: linear-gradient(135deg, rgba(13, 110, 253, 0.08), rgba(32, 201, 151, 0.08));
  }
</style>
