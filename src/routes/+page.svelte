<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';

  import GameSummaryBar from '$lib/components/GameSummaryBar.svelte';
  import PlayerOverview from '$lib/components/PlayerOverview.svelte';
  import PropertyPortfolio from '$lib/components/PropertyPortfolio.svelte';
  import RentalStatus from '$lib/components/RentalStatus.svelte';
  import ActivityHistory from '$lib/components/ActivityHistory.svelte';
  import GameSettings from '$lib/components/GameSettings.svelte';
  import ManagementModal from '$lib/components/ManagementModal.svelte';
  import FinanceModal from '$lib/components/FinanceModal.svelte';

  import {
    propertyCards,
    rentalItems,
    historyEntries,
    managementView,
    financeView,
    day,
    isPaused,
    balanceLabel,
    centralBankRateLabel,
    monthlyCashFlowLabel,
    speedLabel,
    speed,
    setGameSpeed,
    initialiseGame,
    resetGame,
    tickDay,
    manageProperty,
    purchaseProperty,
    setManagementSection,
    closeManagement,
    pauseGame,
    resumeGame,
    setPropertyLeaseMonths,
    setPropertyRentPremium,
    setPropertyAutoRelist,
    setPropertyRentalMarketingActive,
    setPropertyMarketingPaused,
    schedulePropertyMaintenance,
    sellProperty,
    selectFinanceDeposit,
    selectFinanceTerm,
    selectFinanceFixedPeriod,
    setFinanceInterestOnly,
    confirmFinance,
    cancelFinance,
    closeFinance
  } from '$lib/stores/game';

  type TabId = 'dashboard' | 'market' | 'portfolio' | 'settings';

  const navigationTabs: { id: TabId; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'market', label: 'Property Market' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'settings', label: 'Settings' }
  ];

  const speedOptions = [
    { value: '2000', label: '0.5x (slow & steady)' },
    { value: '1000', label: '1x (default)' },
    { value: '500', label: '2x (fast)' },
    { value: '250', label: '4x (very fast)' }
  ];

  let activeTab: TabId = 'dashboard';
  let intervalId: ReturnType<typeof setInterval> | null = null;

  $: marketProperties = $propertyCards.filter((property) => !property.owned);
  $: ownedProperties = $propertyCards.filter((property) => property.owned);

  function stopLoop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function scheduleLoop(speedMs: number, paused: boolean) {
    stopLoop();
    if (!paused) {
      intervalId = setInterval(() => {
        tickDay();
      }, speedMs);
    }
  }

  function handleSpeedChange(event: CustomEvent<string>) {
    const value = Number(event.detail);
    if (Number.isFinite(value) && value > 0) {
      setGameSpeed(value);
    }
  }

  function handleReset() {
    resetGame();
    scheduleLoop(get(speed), get(isPaused));
  }

  function handleManageEvent(event: CustomEvent<string>) {
    manageProperty(event.detail);
  }

  function handlePurchaseEvent(event: CustomEvent<string>) {
    purchaseProperty(event.detail);
  }

  function handleSellEvent(event: CustomEvent<string>) {
    sellProperty(event.detail);
  }

  function handleManagementSectionChange(event: CustomEvent<string>) {
    setManagementSection(event.detail as 'overview' | 'leasing' | 'financing' | 'transactions' | 'maintenance');
  }

  function handleDepositSelectEvent(event: CustomEvent<number>) {
    selectFinanceDeposit(event.detail);
  }

  function handleTermSelectEvent(event: CustomEvent<number>) {
    selectFinanceTerm(event.detail);
  }

  function handleFixedPeriodSelectEvent(event: CustomEvent<number>) {
    selectFinanceFixedPeriod(event.detail);
  }

  function handlePaymentTypeChangeEvent(event: CustomEvent<boolean>) {
    setFinanceInterestOnly(event.detail);
  }

  function handleLeaseChangeEvent(
    event: CustomEvent<{ propertyId: string; leaseMonths: number }>
  ) {
    const { propertyId, leaseMonths } = event.detail;
    if (propertyId && Number.isFinite(leaseMonths)) {
      setPropertyLeaseMonths(propertyId, leaseMonths);
    }
  }

  function handleRentChangeEvent(
    event: CustomEvent<{ propertyId: string; rateOffset: number }>
  ) {
    const { propertyId, rateOffset } = event.detail;
    if (propertyId && Number.isFinite(rateOffset)) {
      setPropertyRentPremium(propertyId, rateOffset);
    }
  }

  function handleAutoRelistToggleEvent(
    event: CustomEvent<{ propertyId: string; enabled: boolean }>
  ) {
    const { propertyId, enabled } = event.detail;
    if (propertyId) {
      setPropertyAutoRelist(propertyId, enabled);
    }
  }

  function handleMarketingActionEvent(
    event: CustomEvent<{ propertyId: string; active: boolean }>
  ) {
    const { propertyId, active } = event.detail;
    if (propertyId) {
      setPropertyRentalMarketingActive(propertyId, active);
    }
  }

  function handleMarketingToggleEvent(
    event: CustomEvent<{ propertyId: string; paused: boolean }>
  ) {
    const { propertyId, paused } = event.detail;
    if (propertyId) {
      setPropertyMarketingPaused(propertyId, paused);
    }
  }

  function handleMaintenanceScheduleEvent(event: CustomEvent<{ propertyId: string }>) {
    const { propertyId } = event.detail ?? {};
    if (propertyId) {
      schedulePropertyMaintenance(propertyId);
    }
  }

  function handleManagementSellEvent(event: CustomEvent<{ propertyId: string }>) {
    const { propertyId } = event.detail ?? {};
    if (propertyId) {
      sellProperty(propertyId);
    }
  }

  function handleFinanceConfirm() {
    confirmFinance();
  }

  function handleFinanceCancel() {
    cancelFinance();
  }

  function handleModalShow() {
    pauseGame();
  }

  function handleManagementHide() {
    closeManagement();
    resumeGame();
  }

  function handleFinanceHide() {
    closeFinance();
    resumeGame();
  }

  onMount(() => {
    initialiseGame();

    const speedUnsubscribe = speed.subscribe((value) => {
      scheduleLoop(value, get(isPaused));
    });

    const pauseUnsubscribe = isPaused.subscribe((paused) => {
      scheduleLoop(get(speed), paused);
    });

    scheduleLoop(get(speed), get(isPaused));

    return () => {
      speedUnsubscribe();
      pauseUnsubscribe();
      stopLoop();
    };
  });

  onDestroy(() => {
    stopLoop();
  });
</script>

<GameSummaryBar
  currentDay={$day}
  balanceLabel={$balanceLabel}
  centralBankRateLabel={$centralBankRateLabel}
/>

<nav class="nav nav-pills nav-fill shadow-sm mb-4 bg-white rounded" aria-label="Main navigation">
  {#each navigationTabs as tab}
    <button
      type="button"
      class={`nav-link py-3 fw-semibold${activeTab === tab.id ? ' active' : ''}`}
      aria-current={activeTab === tab.id ? 'page' : undefined}
      on:click={() => (activeTab = tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</nav>

{#if activeTab === 'dashboard'}
  <div class="row g-4">
    <PlayerOverview
      currentDay={$day}
      isPaused={$isPaused}
      balanceLabel={$balanceLabel}
      centralBankRateLabel={$centralBankRateLabel}
      monthlyCashFlowLabel={$monthlyCashFlowLabel}
    />
  </div>
{:else if activeTab === 'market'}
  <div class="row g-4">
    <PropertyPortfolio
      title="Property Market"
      description="Browse properties available to buy right now. Use manage to inspect details before committing."
      properties={marketProperties}
      showEmptyStateMessage={marketProperties.length === 0}
      on:manage={handleManageEvent}
      on:purchase={handlePurchaseEvent}
      on:sell={handleSellEvent}
    />
  </div>
{:else if activeTab === 'portfolio'}
  <div class="row g-4">
    <PropertyPortfolio
      title="Your Portfolio"
      description="These are the assets you currently own. Open a property to adjust leasing, financing and maintenance."
      properties={ownedProperties}
      showEmptyStateMessage={ownedProperties.length === 0}
      on:manage={handleManageEvent}
      on:purchase={handlePurchaseEvent}
      on:sell={handleSellEvent}
    />
  </div>
  <div class="row g-4 mt-1">
    <RentalStatus items={$rentalItems} on:manage={handleManageEvent} />
  </div>
{:else}
  <div class="row g-4">
    <GameSettings
      speed={$speedLabel}
      speedOptions={speedOptions}
      on:speedchange={handleSpeedChange}
      on:reset={handleReset}
    />
    <ActivityHistory entries={$historyEntries} />
  </div>
{/if}

<ManagementModal
  open={$managementView.open}
  activeSection={$managementView.activeSection}
  subtitle={$managementView.subtitle}
  summaryHtml={$managementView.summaryHtml}
  overviewHtml={$managementView.overviewHtml}
  leasingHtml={$managementView.leasingHtml}
  financingHtml={$managementView.financingHtml}
  transactionsHtml={$managementView.transactionsHtml}
  maintenanceHtml={$managementView.maintenanceHtml}
  propertyId={$managementView.propertyId}
  isOwned={$managementView.isOwned}
  saleState={$managementView.saleState}
  leasingControls={$managementView.leasingControls}
  maintenanceState={$managementView.maintenanceState}
  on:sectionchange={handleManagementSectionChange}
  on:leasechange={handleLeaseChangeEvent}
  on:rentchange={handleRentChangeEvent}
  on:autorelisttoggle={handleAutoRelistToggleEvent}
  on:marketingaction={handleMarketingActionEvent}
  on:marketingtoggle={handleMarketingToggleEvent}
  on:maintenanceschedule={handleMaintenanceScheduleEvent}
  on:sell={handleManagementSellEvent}
  on:show={handleModalShow}
  on:hide={handleManagementHide}
/>

<FinanceModal
  open={$financeView.open}
  propertyName={$financeView.propertyName}
  propertySummary={$financeView.propertySummary}
  depositOptionsHtml={$financeView.depositOptionsHtml}
  fixedPeriodOptionsHtml={$financeView.fixedPeriodOptionsHtml}
  termOptionsHtml={$financeView.termOptionsHtml}
  paymentTypeOptionsHtml={$financeView.paymentTypeOptionsHtml}
  paymentPreviewHtml={$financeView.paymentPreviewHtml}
  affordabilityNoteHtml={$financeView.affordabilityNoteHtml}
  on:depositselect={handleDepositSelectEvent}
  on:termselect={handleTermSelectEvent}
  on:fixedperiodselect={handleFixedPeriodSelectEvent}
  on:paymenttypechange={handlePaymentTypeChangeEvent}
  on:confirm={handleFinanceConfirm}
  on:cancel={handleFinanceCancel}
  on:show={handleModalShow}
  on:hide={handleFinanceHide}
/>
