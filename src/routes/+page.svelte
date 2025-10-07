<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';

  import PlayerOverview from '$lib/components/PlayerOverview.svelte';
  import PropertyPortfolio from '$lib/components/PropertyPortfolio.svelte';
  import RentalStatus from '$lib/components/RentalStatus.svelte';
  import ActivityHistory from '$lib/components/ActivityHistory.svelte';
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
    selectFinanceDeposit,
    selectFinanceTerm,
    selectFinanceFixedPeriod,
    setFinanceInterestOnly,
    confirmFinance,
    cancelFinance,
    closeFinance
  } from '$lib/stores/game';

  const speedOptions = [
    { value: '2000', label: '0.5x (slow & steady)' },
    { value: '1000', label: '1x (default)' },
    { value: '500', label: '2x (fast)' },
    { value: '250', label: '4x (very fast)' }
  ];

  let intervalId: ReturnType<typeof setInterval> | null = null;

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

  function handleFinanceConfirm() {
    confirmFinance();
  }

  function handleFinanceCancel() {
    cancelFinance();
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

<div class="row g-4">
  <PlayerOverview
    currentDay={$day}
    isPaused={$isPaused}
    balanceLabel={$balanceLabel}
    centralBankRateLabel={$centralBankRateLabel}
    monthlyCashFlowLabel={$monthlyCashFlowLabel}
    speed={$speedLabel}
    speedOptions={speedOptions}
    on:speedchange={handleSpeedChange}
    on:reset={handleReset}
  />
  <PropertyPortfolio
    properties={$propertyCards}
    on:manage={handleManageEvent}
    on:purchase={handlePurchaseEvent}
  />
</div>

<div class="row g-4 mt-1">
  <RentalStatus items={$rentalItems} />
  <ActivityHistory entries={$historyEntries} />
</div>

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
  on:sectionchange={handleManagementSectionChange}
  on:hide={closeManagement}
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
  on:hide={closeFinance}
/>
