<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  import type { ManagementLeasingControls } from '$lib/stores/game';
  import { formatCurrency, formatPercentage } from '$lib/utils';

  type BootstrapModal = {
    show: () => void;
    hide: () => void;
    dispose: () => void;
  };

  const dispatch = createEventDispatcher<{
    sectionchange: string;
    show: void;
    hide: void;
    leasechange: { propertyId: string; leaseMonths: number };
    rentchange: { propertyId: string; rateOffset: number };
    autorelisttoggle: { propertyId: string; enabled: boolean };
    marketingtoggle: { propertyId: string; paused: boolean };
  }>();

  const emptyLeasingControls: ManagementLeasingControls = {
    plans: [],
    leaseMonthsOptions: [],
    rentPremiumOptions: [],
    selectedPlanId: '',
    selectedLeaseMonths: 0,
    selectedRateOffset: 0,
    autoRelist: false,
    marketingPaused: false,
    hasTenant: false
  };

  let {
    open = false,
    activeSection = 'overview',
    subtitle = '',
    summaryHtml = '',
    overviewHtml = '',
    leasingHtml = '',
    financingHtml = '',
    transactionsHtml = '',
    maintenanceHtml = '',
    propertyId = '',
    isOwned = false,
    leasingControls = emptyLeasingControls
  } = $props();

  let modalElement: HTMLDivElement | null = null;
  let modalInstance: BootstrapModal | null = null;

  function handleSectionChange(section: string) {
    activeSection = section;
    dispatch('sectionchange', section);
  }

  function getButtonClass(section: string) {
    return `management-nav-link${activeSection === section ? ' active' : ''}`;
  }

  async function ensureModalInstance() {
    if (!modalElement || typeof window === 'undefined') {
      return;
    }

    if (modalInstance) {
      return;
    }

    const bootstrap = (window as unknown as { bootstrap?: { Modal?: any } }).bootstrap;

    if (bootstrap?.Modal) {
      modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement, {
        focus: true
      }) as BootstrapModal;
      modalElement.addEventListener('shown.bs.modal', handleShownEvent);
      modalElement.addEventListener('hidden.bs.modal', handleHiddenEvent);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    await ensureModalInstance();
  }

  function handleShownEvent() {
    dispatch('show');
  }

  function handleHiddenEvent() {
    dispatch('hide');
  }

  function showModal() {
    ensureModalInstance().then(() => {
      modalInstance?.show();
    });
  }

  function hideModal() {
    modalInstance?.hide();
  }

  onMount(() => {
    ensureModalInstance();
  });

  onDestroy(() => {
    if (modalElement) {
      modalElement.removeEventListener('shown.bs.modal', handleShownEvent);
      modalElement.removeEventListener('hidden.bs.modal', handleHiddenEvent);
    }
    modalInstance?.dispose();
    modalInstance = null;
  });

  $effect(() => {
    if (open) {
      showModal();
    } else {
      hideModal();
    }
  });

  const leaseSliderMax = $derived.by(() =>
    Math.max(leasingControls.leaseMonthsOptions.length - 1, 0)
  );
  const rentSliderMax = $derived.by(() =>
    Math.max(leasingControls.rentPremiumOptions.length - 1, 0)
  );
  const leaseIndex = $derived.by(() => {
    const idx = leasingControls.leaseMonthsOptions.findIndex(
      (value) => value === leasingControls.selectedLeaseMonths
    );
    return idx >= 0 ? idx : 0;
  });
  const rentIndex = $derived.by(() => {
    const idx = leasingControls.rentPremiumOptions.findIndex(
      (option) => Math.abs(option.value - leasingControls.selectedRateOffset) < 1e-6
    );
    return idx >= 0 ? idx : 0;
  });
  const selectedPlan = $derived.by(() =>
    leasingControls.plans.find((plan) => plan.id === leasingControls.selectedPlanId) ?? null
  );

  function formatPremium(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  function handleLeaseSliderChange(event: Event) {
    if (!propertyId || leaseSliderMax <= 0) {
      return;
    }
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    const index = Number(input.value);
    if (!Number.isFinite(index)) {
      return;
    }
    const months = leasingControls.leaseMonthsOptions[index] ?? leasingControls.selectedLeaseMonths;
    if (!Number.isFinite(months)) {
      return;
    }
    dispatch('leasechange', { propertyId, leaseMonths: months });
  }

  function handleRentSliderChange(event: Event) {
    if (!propertyId || rentSliderMax <= 0) {
      return;
    }
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    const index = Number(input.value);
    if (!Number.isFinite(index)) {
      return;
    }
    const option = leasingControls.rentPremiumOptions[index] ?? null;
    if (!option) {
      return;
    }
    dispatch('rentchange', { propertyId, rateOffset: option.value });
  }

  function handleAutoRelistToggle(event: Event) {
    if (!propertyId) {
      return;
    }
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    dispatch('autorelisttoggle', { propertyId, enabled: input.checked });
  }

  function handleMarketingToggle(event: Event) {
    if (!propertyId) {
      return;
    }
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    dispatch('marketingtoggle', { propertyId, paused: input.checked });
  }
</script>

<div
  bind:this={modalElement}
  class="modal fade"
  id="managementModal"
  tabindex="-1"
  aria-labelledby="managementModalLabel"
  aria-modal="true"
  role="dialog"
  data-bs-focus="true"
>
  <div class="modal-dialog modal-dialog-scrollable modal-xl">
    <div class="modal-content management-modal">
      <div class="modal-header">
        <div>
          <h5 class="modal-title" id="managementModalLabel">Property management</h5>
          <p id="managementModalSubtitle" class="mb-0 small text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="modal"
          aria-label="Close management hub"
        ></button>
      </div>
      <div class="modal-body">
        <div class="management-summary" id="managementModalSummary">
          {@html summaryHtml}
        </div>
        <div class="management-layout">
          <div
            id="managementSectionNav"
            class="management-nav"
            role="tablist"
            aria-orientation="vertical"
          >
            <button
              type="button"
              class={getButtonClass('overview')}
              data-section="overview"
              id="management-tab-overview"
              aria-controls="management-panel-overview"
              aria-pressed={activeSection === 'overview'}
              onclick={() => handleSectionChange('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              class={getButtonClass('leasing')}
              data-section="leasing"
              id="management-tab-leasing"
              aria-controls="management-panel-leasing"
              aria-pressed={activeSection === 'leasing'}
              onclick={() => handleSectionChange('leasing')}
            >
              Leasing
            </button>
            <button
              type="button"
              class={getButtonClass('financing')}
              data-section="financing"
              id="management-tab-financing"
              aria-controls="management-panel-financing"
              aria-pressed={activeSection === 'financing'}
              onclick={() => handleSectionChange('financing')}
            >
              Financing
            </button>
            <button
              type="button"
              class={getButtonClass('transactions')}
              data-section="transactions"
              id="management-tab-transactions"
              aria-controls="management-panel-transactions"
              aria-pressed={activeSection === 'transactions'}
              onclick={() => handleSectionChange('transactions')}
            >
              Buying &amp; Selling
            </button>
            <button
              type="button"
              class={getButtonClass('maintenance')}
              data-section="maintenance"
              id="management-tab-maintenance"
              aria-controls="management-panel-maintenance"
              aria-pressed={activeSection === 'maintenance'}
              onclick={() => handleSectionChange('maintenance')}
            >
              Maintenance
            </button>
          </div>
          <div class="management-content">
            <div
              id="management-panel-overview"
              class={`management-section${activeSection === 'overview' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-overview"
            >
              <div id="managementOverview">
                {@html overviewHtml}
              </div>
            </div>
            <div
              id="management-panel-leasing"
              class={`management-section${activeSection === 'leasing' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-leasing"
            >
              <div id="managementLeasing">
                {@html leasingHtml}
                {#if isOwned}
                  <div class="leasing-controls mt-3 d-flex flex-column gap-3">
                    {#if leaseSliderMax > 0}
                      <div>
                        <label for="leaseLengthRange" class="form-label fw-semibold">Lease length</label>
                        <input
                          id="leaseLengthRange"
                          type="range"
                          class="form-range"
                          min="0"
                          max={leaseSliderMax}
                          value={leaseIndex}
                          step="1"
                          onchange={handleLeaseSliderChange}
                        />
                        {#if leasingControls.leaseMonthsOptions.length > 0}
                          <div class="d-flex justify-content-between small text-muted">
                            {#each leasingControls.leaseMonthsOptions as months, idx}
                              <span class={idx === leaseIndex ? 'fw-semibold text-primary' : ''}
                                >{months} mo</span
                              >
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                    {#if rentSliderMax > 0}
                      <div>
                        <label for="rentPremiumRange" class="form-label fw-semibold">Rent premium</label>
                        <input
                          id="rentPremiumRange"
                          type="range"
                          class="form-range"
                          min="0"
                          max={rentSliderMax}
                          value={rentIndex}
                          step="1"
                          onchange={handleRentSliderChange}
                        />
                        {#if leasingControls.rentPremiumOptions.length > 0}
                          <div class="d-flex justify-content-between small text-muted">
                            {#each leasingControls.rentPremiumOptions as option, idx}
                              <span class={idx === rentIndex ? 'fw-semibold text-primary' : ''}
                                >{formatPremium(option.value)}</span
                              >
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                    <div class="form-check form-switch">
                      <input
                        id="autoRelistSwitch"
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={leasingControls.autoRelist}
                        onchange={handleAutoRelistToggle}
                      />
                      <label class="form-check-label" for="autoRelistSwitch">
                        Auto-relist vacant property
                      </label>
                    </div>
                    <div class="form-check form-switch">
                      <input
                        id="marketingPauseSwitch"
                        class="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={leasingControls.marketingPaused}
                        onchange={handleMarketingToggle}
                      />
                      <label class="form-check-label" for="marketingPauseSwitch">
                        Pause marketing for maintenance
                      </label>
                    </div>
                    {#if selectedPlan}
                      <div class="alert alert-light border small mb-0" role="status">
                        <p class="mb-1">
                          <strong>Lease:</strong> {selectedPlan.leaseMonths}-month term ·
                          {formatPremium(selectedPlan.rateOffset)} premium
                        </p>
                        <p class="mb-1">
                          <strong>Expected rent:</strong> {formatCurrency(selectedPlan.monthlyRent)}
                        </p>
                        <p class="mb-0">
                          <strong>Monthly placement chance:</strong>
                          {formatPercentage(selectedPlan.probability)}
                        </p>
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="alert alert-info mt-3 mb-0 small" role="status">
                    Purchase the property to configure leasing preferences.
                  </div>
                {/if}
              </div>
            </div>
            <div
              id="management-panel-financing"
              class={`management-section${activeSection === 'financing' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-financing"
            >
              <div id="managementFinancing">
                {@html financingHtml}
              </div>
            </div>
            <div
              id="management-panel-transactions"
              class={`management-section${activeSection === 'transactions' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-transactions"
            >
              <div id="managementTransactions">
                {@html transactionsHtml}
              </div>
            </div>
            <div
              id="management-panel-maintenance"
              class={`management-section${activeSection === 'maintenance' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-maintenance"
            >
              <div id="managementMaintenance">
                {@html maintenanceHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
          Close
        </button>
      </div>
    </div>
  </div>
</div>
