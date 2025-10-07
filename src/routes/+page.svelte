<script lang="ts">
  import PlayerOverview from '$lib/components/PlayerOverview.svelte';
  import PropertyPortfolio from '$lib/components/PropertyPortfolio.svelte';
  import RentalStatus from '$lib/components/RentalStatus.svelte';
  import ActivityHistory from '$lib/components/ActivityHistory.svelte';
  import ManagementModal from '$lib/components/ManagementModal.svelte';
  import FinanceModal from '$lib/components/FinanceModal.svelte';
  import type { HistoryEntry, PropertyCard, RentalItem } from '$lib/types';

  const portfolioProperties: PropertyCard[] = [
    {
      id: 'maple-heights',
      name: 'Maple Heights Apartments',
      description: 'Modern two-bedroom apartment with skyline views and on-site concierge service.',
      summaryHtml: '<strong>2</strong> bed · <strong>2</strong> bath · Apartment',
      featureTags: ['City centre', 'Parking included', 'Gym access'],
      locationDetailsHtml:
        '<strong>Location:</strong> Riverfront district · 85% transit access · Schools 8/10 · Crime score 3/10',
      maintenanceLabel: '92% condition',
      maintenancePercent: 92,
      demandHtml: '<strong>Demand:</strong> 8/10 · Estimated yield 6.2%',
      costHtml: '<strong>Cost:</strong> $285,000',
      rentHtml:
        '<strong>Target rent:</strong> $1,650 <span class="text-muted">(75% monthly placement · 12-month lease · Base +1.2%)</span>',
      statusChips: [
        { label: 'Vacant', variant: 'bg-secondary' },
        { label: 'Advertising', variant: 'bg-warning text-dark' },
        { label: 'Auto-relist on', variant: 'bg-success' }
      ]
    },
    {
      id: 'oakwood-villas',
      name: 'Oakwood Villas',
      description: 'Spacious suburban semi-detached property with mature gardens and garage.',
      summaryHtml: '<strong>3</strong> bed · <strong>2</strong> bath · Semi-detached',
      featureTags: ['Garden', 'Garage', 'Near schools'],
      locationDetailsHtml:
        '<strong>Location:</strong> Oakwood suburb · 72% transit access · Schools 9/10 · Crime score 2/10',
      maintenanceLabel: '88% condition',
      maintenancePercent: 88,
      demandHtml: '<strong>Demand:</strong> 7/10 · Estimated yield 5.4%',
      costHtml: '<strong>Cost:</strong> $340,000',
      rentHtml:
        '<strong>Current rent:</strong> $1,850 <span class="text-muted">(9 months remaining)</span>',
      statusChips: [
        { label: 'Tenant in place (9 months remaining)', variant: 'bg-success' }
      ],
      owned: true,
      disablePurchase: true,
      manageLabel: 'Manage lease'
    }
  ];

  const rentalItems: RentalItem[] = [
    {
      id: 'rental-1',
      contentHtml:
        '<strong>Maple Heights Apartments:</strong> Advertising campaign live. Expect tenant placement within 4 weeks.'
    },
    {
      id: 'rental-2',
      contentHtml:
        '<strong>Oakwood Villas:</strong> Tenant paid rent on time. Lease renewal reminder set for 3 months.'
    }
  ];

  const historyEntries: HistoryEntry[] = [
    {
      id: 'history-1',
      contentHtml: '<code>[Day 31]</code> Received $1,850 rent from Oakwood Villas.'
    },
    {
      id: 'history-2',
      contentHtml: '<code>[Day 30]</code> Scheduled viewing for Maple Heights Apartments (3 prospective tenants).'
    }
  ];

  let currentDay = 42;
  let isPaused = false;
  let balanceLabel = '$128,400';
  let centralBankRateLabel = '4.50%';
  let monthlyCashFlowLabel = '$3,240 <small class="text-muted">(rent $5,500 - mortgages $2,260)</small>';
  let gameSpeed = '1000';

  let managementModalOpen = false;
  let managementSubtitle = '';
  let managementActiveSection = 'overview';
  let managementSummaryHtml = '';
  let managementOverviewHtml = '';
  let managementLeasingHtml = '';
  let managementFinancingHtml = '';
  let managementTransactionsHtml = '';
  let managementMaintenanceHtml = '';

  let financeModalOpen = false;
  let financePropertyName = '';
  let financePropertySummary = '';
  let selectedDepositRatio = 0.2;
  let selectedTermYears = 25;
  let selectedFixedPeriodYears = 5;
  let interestOnly = false;

  const depositOptions = [0.1, 0.2, 0.3];
  const termOptions = [15, 20, 25, 30];
  const fixedPeriodOptions = [2, 5, 10];

  function formatPercentage(value: number) {
    return `${Math.round(value * 100)}%`;
  }

  function openManagementModal(property: PropertyCard) {
    managementModalOpen = true;
    managementSubtitle = property.name;
    managementActiveSection = 'overview';
    managementSummaryHtml = `
      <div class="metric">
        <span class="label">Gross rent</span>
        <span class="value">$${property.id === 'oakwood-villas' ? '1,850' : '0'}</span>
      </div>
      <div class="metric">
        <span class="label">Occupancy</span>
        <span class="value">${property.statusChips?.[0]?.label ?? 'Vacant'}</span>
      </div>
    `;
    managementOverviewHtml = `
      <div class="section-card">
        <h6>Performance snapshot</h6>
        <p class="mb-0">Detailed management insights for <strong>${property.name}</strong> will appear here once the game logic is connected.</p>
      </div>
    `;
    managementLeasingHtml = `
      <div class="section-card">
        <h6>Leasing actions</h6>
        <p class="mb-0">Use this section to adjust marketing or leasing strategies.</p>
      </div>
    `;
    managementFinancingHtml = `
      <div class="section-card">
        <h6>Financing</h6>
        <p class="mb-0">Mortgage details and refinancing options will populate here.</p>
      </div>
    `;
    managementTransactionsHtml = `
      <div class="section-card">
        <h6>Transactions</h6>
        <p class="mb-0">Purchase and sale history for ${property.name} is coming soon.</p>
      </div>
    `;
    managementMaintenanceHtml = `
      <div class="section-card">
        <h6>Maintenance</h6>
        <p class="mb-0">Track scheduled maintenance and repairs in this panel.</p>
      </div>
    `;
  }

  function openFinanceModal(property: PropertyCard) {
    financeModalOpen = true;
    financePropertyName = property.name;
    financePropertySummary = `${property.summaryHtml ?? ''}`;
    selectedDepositRatio = 0.2;
    selectedTermYears = 25;
    selectedFixedPeriodYears = 5;
    interestOnly = false;
  }

  function handleSpeedChange(value: string) {
    gameSpeed = value;
  }

  function handleReset() {
    currentDay = 1;
    balanceLabel = '$100,000';
    monthlyCashFlowLabel = '$0';
  }

  function handlePurchase(propertyId: string) {
    const property = portfolioProperties.find((item) => item.id === propertyId);
    if (property) {
      openFinanceModal(property);
    }
  }

  function handleManage(propertyId: string) {
    const property = portfolioProperties.find((item) => item.id === propertyId);
    if (property) {
      openManagementModal(property);
    }
  }

  function handleManagementSectionChange(section: string) {
    managementActiveSection = section;
  }

  function handleDepositSelect(ratio: number) {
    selectedDepositRatio = ratio;
  }

  function handleTermSelect(years: number) {
    selectedTermYears = years;
    if (selectedFixedPeriodYears > years) {
      selectedFixedPeriodYears = years;
    }
  }

  function handleFixedPeriodSelect(years: number) {
    selectedFixedPeriodYears = years;
  }

  function handlePaymentTypeChange(isInterestOnly: boolean) {
    interestOnly = isInterestOnly;
  }

  function handleFinanceConfirm() {
    financeModalOpen = false;
  }

  function handleFinanceCancel() {
    financeModalOpen = false;
  }

  function handleSpeedChangeEvent(event: CustomEvent<string>) {
    handleSpeedChange(event.detail);
  }

  function handleManageEvent(event: CustomEvent<string>) {
    handleManage(event.detail);
  }

  function handlePurchaseEvent(event: CustomEvent<string>) {
    handlePurchase(event.detail);
  }

  function handleManagementSectionChangeEvent(event: CustomEvent<string>) {
    handleManagementSectionChange(event.detail);
  }

  function handleDepositSelectEvent(event: CustomEvent<number>) {
    handleDepositSelect(event.detail);
  }

  function handleTermSelectEvent(event: CustomEvent<number>) {
    handleTermSelect(event.detail);
  }

  function handleFixedPeriodSelectEvent(event: CustomEvent<number>) {
    handleFixedPeriodSelect(event.detail);
  }

  function handlePaymentTypeChangeEvent(event: CustomEvent<boolean>) {
    handlePaymentTypeChange(event.detail);
  }

  $: depositOptionsHtml = depositOptions
    .map((ratio) => {
      const isActive = Math.abs(ratio - selectedDepositRatio) < 1e-6;
      return `
        <button
          type="button"
          class="btn btn-outline-primary${isActive ? ' active' : ''}"
          data-deposit-ratio="${ratio}"
          aria-pressed="${isActive}"
        >
          ${formatPercentage(ratio)}
        </button>
      `;
    })
    .join('');

  $: termOptionsHtml = termOptions
    .map((years) => {
      const isActive = years === selectedTermYears;
      return `
        <button
          type="button"
          class="btn btn-outline-primary${isActive ? ' active' : ''}"
          data-term-years="${years}"
          aria-pressed="${isActive}"
        >
          ${years} years
        </button>
      `;
    })
    .join('');

  $: fixedPeriodOptionsHtml = fixedPeriodOptions
    .map((years) => {
      const disabled = years > selectedTermYears;
      const isActive = years === selectedFixedPeriodYears && !disabled;
      return `
        <button
          type="button"
          class="btn btn-outline-primary${isActive ? ' active' : ''}"
          data-fixed-period-years="${years}"
          aria-pressed="${isActive}"
          ${disabled ? 'disabled' : ''}
        >
          ${years} years
        </button>
      `;
    })
    .join('');

  $: paymentTypeOptionsHtml = `
    <button
      type="button"
      class="btn btn-outline-secondary${interestOnly ? '' : ' active'}"
      data-interest-only="false"
      aria-pressed="${interestOnly ? 'false' : 'true'}"
    >
      Repayment
    </button>
    <button
      type="button"
      class="btn btn-outline-secondary${interestOnly ? ' active' : ''}"
      data-interest-only="true"
      aria-pressed="${interestOnly ? 'true' : 'false'}"
    >
      Interest-only
    </button>
  `;

  $: paymentPreviewHtml = `
    <p class="mb-2">Deposit ratio: <strong>${formatPercentage(selectedDepositRatio)}</strong></p>
    <p class="mb-2">Term length: <strong>${selectedTermYears} years</strong></p>
    <p class="mb-2">Fixed-rate period: <strong>${selectedFixedPeriodYears} years</strong></p>
    <p class="mb-0">Structure: <strong>${interestOnly ? 'Interest-only' : 'Repayment'}</strong></p>
  `;

  $: affordabilityNoteHtml =
    '<span class="text-muted">Detailed affordability analysis will be calculated by the game engine.</span>';
</script>

<div class="row g-4">
  <PlayerOverview
    currentDay={currentDay}
    isPaused={isPaused}
    balanceLabel={balanceLabel}
    centralBankRateLabel={centralBankRateLabel}
    monthlyCashFlowLabel={monthlyCashFlowLabel}
    speed={gameSpeed}
    on:speedchange={handleSpeedChangeEvent}
    on:reset={handleReset}
  />
  <PropertyPortfolio
    properties={portfolioProperties}
    on:manage={handleManageEvent}
    on:purchase={handlePurchaseEvent}
  />
</div>

<div class="row g-4 mt-1">
  <RentalStatus items={rentalItems} />
  <ActivityHistory entries={historyEntries} />
</div>

<ManagementModal
  open={managementModalOpen}
  activeSection={managementActiveSection}
  subtitle={managementSubtitle}
  summaryHtml={managementSummaryHtml}
  overviewHtml={managementOverviewHtml}
  leasingHtml={managementLeasingHtml}
  financingHtml={managementFinancingHtml}
  transactionsHtml={managementTransactionsHtml}
  maintenanceHtml={managementMaintenanceHtml}
  on:sectionchange={handleManagementSectionChangeEvent}
  on:hide={() => (managementModalOpen = false)}
/>

<FinanceModal
  open={financeModalOpen}
  propertyName={financePropertyName}
  propertySummary={financePropertySummary}
  depositOptionsHtml={depositOptionsHtml}
  fixedPeriodOptionsHtml={fixedPeriodOptionsHtml}
  termOptionsHtml={termOptionsHtml}
  paymentTypeOptionsHtml={paymentTypeOptionsHtml}
  paymentPreviewHtml={paymentPreviewHtml}
  affordabilityNoteHtml={affordabilityNoteHtml}
  on:depositselect={handleDepositSelectEvent}
  on:termselect={handleTermSelectEvent}
  on:fixedperiodselect={handleFixedPeriodSelectEvent}
  on:paymenttypechange={handlePaymentTypeChangeEvent}
  on:confirm={handleFinanceConfirm}
  on:cancel={handleFinanceCancel}
  on:hide={() => (financeModalOpen = false)}
/>
