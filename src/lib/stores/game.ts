import { derived, get, writable } from 'svelte/store';
import {
  FINANCE_CONFIG,
  MAINTENANCE_CONFIG,
  defaultProperties,
  featureAddOns as FEATURE_ADD_ONS,
  propertyTypeMultipliers,
  type PropertyDefinition
} from '$lib/config';
import type { HistoryEntry, PropertyCard, RentalItem } from '$lib/types';
import { formatCurrency, formatInterestRate, formatPercentage, formatPropertyType } from '$lib/utils';

type RentPlan = {
  id: string;
  label: string;
  leaseMonths: number;
  rateOffset: number;
  monthlyRent: number;
  probability: number;
};

type Tenant = {
  leaseMonthsRemaining: number;
  monthlyRent: number;
};

type Mortgage = {
  depositRatio: number;
  deposit: number;
  principal: number;
  fixedPeriodYears: number;
  interestOnly: boolean;
  annualInterestRate: number;
  reversionRate: number;
  monthlyPayment: number;
  remainingTermMonths: number;
};

type GameProperty = PropertyDefinition & {
  baseValue: number;
  cost: number;
  maintenancePercent: number;
  monthlyRentEstimate: number;
  rentPlanId: string;
  tenant: Tenant | null;
  mortgage: Mortgage | null;
  autoRelist: boolean;
  rentalMarketingPausedForMaintenance: boolean;
};

type HistoryEvent = {
  id: string;
  day: number;
  message: string;
};

type FinanceState = {
  open: boolean;
  propertyId: string | null;
  depositRatio: number;
  termYears: number;
  fixedPeriodYears: number;
  interestOnly: boolean;
  validationError: string | null;
};

type ManagementState = {
  open: boolean;
  propertyId: string | null;
  activeSection: 'overview' | 'leasing' | 'financing' | 'transactions' | 'maintenance';
};

type GameState = {
  balance: number;
  day: number;
  centralBankRate: number;
  speed: number;
  isPaused: boolean;
  market: GameProperty[];
  portfolio: GameProperty[];
  history: HistoryEvent[];
  lastCentralBankAdjustmentDay: number;
  lastRentCollectionDay: number;
  finance: FinanceState;
  management: ManagementState;
};

const MINIMUM_DEPOSIT_RATIO = Math.min(...FINANCE_CONFIG.depositOptions);

const RENT_RATE_OFFSETS = [-0.01, 0, 0.0125];
const LEASE_LENGTH_CHOICES = [12, 18, 24];

let historyIdCounter = 1;

function formatPercent(value: number): string {
  return formatPercentage(value / 100);
}

function clampMaintenancePercent(value?: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.min(Math.max(value ?? 0, 0), 100);
  return Math.round(clamped * 10) / 10;
}

function calculatePropertyValue(property: PropertyDefinition): number {
  const weights = {
    base: 220,
    bedrooms: 95,
    bathrooms: 80,
    proximity: 160,
    schoolRating: 22,
    safety: 18
  } as const;

  const location = property.location ?? {};

  const proximityScore = (location.proximity ?? 0) * weights.proximity;
  const schoolScore = (location.schoolRating ?? 0) * weights.schoolRating;
  const safetyScore = (10 - (location.crimeScore ?? 5)) * weights.safety;

  const featureScore = property.features.reduce(
    (total, feature) => total + (FEATURE_ADD_ONS[feature] ?? 35),
    0
  );

  const baseValue =
    weights.base +
    property.bedrooms * weights.bedrooms +
    property.bathrooms * weights.bathrooms +
    proximityScore +
    schoolScore +
    safetyScore +
    featureScore;

  const typeMultiplier = propertyTypeMultipliers[property.propertyType] ?? 1;

  return Math.round(baseValue * typeMultiplier);
}

function calculateMaintenanceAdjustedValue(baseValue: number, maintenancePercent: number): number {
  const percent = clampMaintenancePercent(maintenancePercent);
  return Math.max(Math.round((baseValue * percent) / 100), 0);
}

function calculateMonthlyRentEstimate(cost: number, demandScore: number): number {
  const baseRent = cost * 0.0065;
  const demandPremium = (demandScore - 5) * 45;
  return Math.max(Math.round(baseRent + demandPremium), 0);
}

function getInitialMaintenancePercent(preferred?: number): number {
  if (Number.isFinite(preferred)) {
    return clampMaintenancePercent(preferred);
  }
  const [minPercent, maxPercent] = MAINTENANCE_CONFIG.initialPercentRange;
  return clampMaintenancePercent((minPercent + maxPercent) / 2);
}

function createInitialProperty(definition: PropertyDefinition): GameProperty {
  const baseValue = calculatePropertyValue(definition);
  const maintenancePercent = getInitialMaintenancePercent(definition.maintenancePercent);
  const cost = calculateMaintenanceAdjustedValue(baseValue, maintenancePercent);
  const monthlyRentEstimate = calculateMonthlyRentEstimate(cost, definition.demandScore);
  const rentPlanId = buildRentPlanId(LEASE_LENGTH_CHOICES[1], RENT_RATE_OFFSETS[1]);

  return {
    ...definition,
    baseValue,
    cost,
    maintenancePercent,
    monthlyRentEstimate,
    rentPlanId,
    tenant: null,
    mortgage: null,
    autoRelist: true,
    rentalMarketingPausedForMaintenance: false
  };
}

function buildRentPlanId(leaseMonths: number, rateOffset: number): string {
  const rateKey = Math.round(rateOffset * 1000);
  return `lease-${leaseMonths}-rate-${rateKey}`;
}

function getRentStrategies(property: GameProperty): RentPlan[] {
  return LEASE_LENGTH_CHOICES.flatMap((leaseMonths) =>
    RENT_RATE_OFFSETS.map((rateOffset) => {
      const monthlyRent = Math.round(property.monthlyRentEstimate * (1 + rateOffset * 5));
      const demandScore = property.demandScore ?? 5;
      const maintenanceFactor = property.maintenancePercent / 100;
      const baseProbability = Math.min(0.15 + demandScore * 0.08, 0.95);
      const leaseFactor = 1 - (leaseMonths - LEASE_LENGTH_CHOICES[0]) / 60;
      const rateFactor = 1 - Math.abs(rateOffset) * 12;
      const probability = Math.max(Math.min(baseProbability * leaseFactor * rateFactor * maintenanceFactor, 0.95), 0.05);
      return {
        id: buildRentPlanId(leaseMonths, rateOffset),
        label: `${leaseMonths}-month · ${(rateOffset * 100).toFixed(1)}% premium`,
        leaseMonths,
        rateOffset,
        monthlyRent,
        probability
      };
    })
  );
}

function deriveMortgageRateProfile({
  centralBankRate,
  depositRatio,
  fixedPeriodYears
}: {
  centralBankRate: number;
  depositRatio: number;
  fixedPeriodYears: number;
}): { fixedRate: number; reversionRate: number } {
  const marginBase = FINANCE_CONFIG.rateModel.variableMarginBase;
  const depositFactor = FINANCE_CONFIG.rateModel.variableMarginDepositFactor;
  const minimumMargin = FINANCE_CONFIG.rateModel.minimumMargin;
  const depositAdjustment = depositRatio * depositFactor;
  const margin = Math.max(minimumMargin, marginBase - depositAdjustment);
  const reversionRate = clampRate(centralBankRate + margin);
  const incentive = FINANCE_CONFIG.rateModel.fixedRateIncentives[fixedPeriodYears] ?? 0;
  const fixedRate = clampRate(reversionRate + incentive);
  return { fixedRate, reversionRate };
}

function clampRate(rate: number): number {
  const min = FINANCE_CONFIG.minimumRate;
  const max = FINANCE_CONFIG.maximumRate;
  return Math.min(Math.max(rate, min), max);
}

function calculateMonthlyPayment({
  principal,
  annualRate,
  termMonths,
  interestOnly
}: {
  principal: number;
  annualRate: number;
  termMonths: number;
  interestOnly: boolean;
}): number {
  const monthlyRate = annualRate / 12;
  if (interestOnly) {
    return Math.round(principal * monthlyRate);
  }
  if (monthlyRate === 0) {
    return Math.round(principal / termMonths);
  }
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
  return Math.round(numerator / denominator);
}

function createMortgage(property: GameProperty, state: GameState): Mortgage {
  const deposit = Math.round(property.cost * state.finance.depositRatio);
  const principal = Math.max(property.cost - deposit, 0);
  const { fixedRate, reversionRate } = deriveMortgageRateProfile({
    centralBankRate: state.centralBankRate,
    depositRatio: state.finance.depositRatio,
    fixedPeriodYears: state.finance.fixedPeriodYears
  });
  const termMonths = state.finance.termYears * 12;
  const monthlyPayment = calculateMonthlyPayment({
    principal,
    annualRate: fixedRate,
    termMonths,
    interestOnly: state.finance.interestOnly
  });
  return {
    depositRatio: state.finance.depositRatio,
    deposit,
    principal,
    fixedPeriodYears: state.finance.fixedPeriodYears,
    interestOnly: state.finance.interestOnly,
    annualInterestRate: fixedRate,
    reversionRate,
    monthlyPayment,
    remainingTermMonths: termMonths
  };
}

function createHistoryEvent(day: number, message: string): HistoryEvent {
  const id = `history-${historyIdCounter}`;
  historyIdCounter += 1;
  return { id, day, message };
}

function addHistory(state: GameState, message: string): GameState {
  const entry = createHistoryEvent(state.day, message);
  const history = [...state.history, entry].slice(-80);
  return { ...state, history };
}

function degradeMaintenance(property: GameProperty, days = 1, occupied = false): GameProperty {
  const decayPerMonth = occupied
    ? MAINTENANCE_CONFIG.occupiedDecayPerMonth
    : MAINTENANCE_CONFIG.unoccupiedDecayPerMonth;
  const decayPerDay = decayPerMonth / 30;
  const updatedPercent = clampMaintenancePercent(property.maintenancePercent - decayPerDay * days);
  return { ...property, maintenancePercent: updatedPercent };
}

function processMonthlyTick(state: GameState): GameState {
  let nextState: GameState = { ...state };
  let balanceChange = 0;
  const updatedPortfolio = nextState.portfolio.map((property) => {
    let updated = { ...property };
    let historyMessages: string[] = [];

    if (updated.tenant) {
      balanceChange += updated.tenant.monthlyRent;
      historyMessages.push(
        `Received ${formatCurrency(updated.tenant.monthlyRent)} rent from ${updated.name}.`
      );
      const remaining = Math.max(updated.tenant.leaseMonthsRemaining - 1, 0);
      if (remaining === 0) {
        historyMessages.push(`Lease completed at ${updated.name}. Property is now vacant.`);
        updated = { ...updated, tenant: null };
      } else {
        updated = {
          ...updated,
          tenant: { ...updated.tenant, leaseMonthsRemaining: remaining }
        };
      }
    } else {
    const plans = getRentStrategies(updated);
      const selectedPlan = plans.find((plan) => plan.id === updated.rentPlanId) ?? plans[0];
      const successChance = selectedPlan?.probability ?? 0.2;
      if (Math.random() < successChance) {
        updated = {
          ...updated,
          tenant: {
            leaseMonthsRemaining: selectedPlan.leaseMonths,
            monthlyRent: selectedPlan.monthlyRent
          }
        };
        historyMessages.push(
          `Placed a tenant at ${updated.name} on a ${selectedPlan.leaseMonths}-month lease.`
        );
      } else {
        historyMessages.push(`No tenant secured for ${updated.name} this month.`);
      }
    }

    if (updated.mortgage) {
      balanceChange -= updated.mortgage.monthlyPayment;
      historyMessages.push(
        `Paid ${formatCurrency(updated.mortgage.monthlyPayment)} mortgage payment for ${updated.name}.`
      );
      const remaining = Math.max(updated.mortgage.remainingTermMonths - 1, 0);
      updated = {
        ...updated,
        mortgage: { ...updated.mortgage, remainingTermMonths: remaining }
      };
    }

    historyMessages.forEach((message) => {
      nextState = addHistory(nextState, message);
    });

    return updated;
  });

  nextState.portfolio = updatedPortfolio;
  nextState.balance = Math.max(nextState.balance + balanceChange, 0);
  nextState.lastRentCollectionDay = nextState.day;

  return nextState;
}

function adjustCentralBankRateIfNeeded(state: GameState): GameState {
  const interval = FINANCE_CONFIG.centralBank.adjustmentIntervalDays ?? 30;
  if (interval <= 0) {
    return state;
  }
  if (state.day - state.lastCentralBankAdjustmentDay < interval) {
    return state;
  }

  const maxStep = FINANCE_CONFIG.centralBank.maxStepPerAdjustment ?? 0.0015;
  const direction = Math.random() < 0.5 ? -1 : 1;
  const change = Math.random() * maxStep * direction;
  const adjustedRate = clampRate(state.centralBankRate + change);
  const message =
    adjustedRate > state.centralBankRate
      ? `Central bank increased the base rate to ${(adjustedRate * 100).toFixed(2)}%.`
      : `Central bank reduced the base rate to ${(adjustedRate * 100).toFixed(2)}%.`;

  return {
    ...addHistory(state, message),
    centralBankRate: adjustedRate,
    lastCentralBankAdjustmentDay: state.day
  };
}

function degradeAllProperties(state: GameState): GameState {
  const portfolio = state.portfolio.map((property) =>
    degradeMaintenance(property, 1, Boolean(property.tenant))
  );
  const market = state.market.map((property) => degradeMaintenance(property, 1, false));
  return { ...state, portfolio, market };
}

function computeMonthlyCashFlow(state: GameState): number {
  return state.portfolio.reduce((total, property) => {
    const rent = property.tenant?.monthlyRent ?? 0;
    const mortgage = property.mortgage?.monthlyPayment ?? 0;
    return total + (rent - mortgage);
  }, 0);
}

function createInitialState(): GameState {
  const market = defaultProperties.map(createInitialProperty);
  return {
    balance: 1000,
    day: 1,
    centralBankRate: FINANCE_CONFIG.centralBank.initialRate,
    speed: 1000,
    isPaused: false,
    market,
    portfolio: [],
    history: [],
    lastCentralBankAdjustmentDay: 0,
    lastRentCollectionDay: 0,
    finance: {
      open: false,
      propertyId: null,
      depositRatio: FINANCE_CONFIG.defaultDepositRatio,
      termYears: FINANCE_CONFIG.defaultTermYears,
      fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
      interestOnly: false,
      validationError: null
    },
    management: {
      open: false,
      propertyId: null,
      activeSection: 'overview'
    }
  };
}

export const gameState = writable<GameState>(createInitialState());

export const balance = derived(gameState, ($state) => $state.balance);
export const day = derived(gameState, ($state) => $state.day);
export const centralBankRate = derived(gameState, ($state) => $state.centralBankRate);
export const market = derived(gameState, ($state) => $state.market);
export const portfolio = derived(gameState, ($state) => $state.portfolio);
export const history = derived(gameState, ($state) => $state.history);
export const speed = derived(gameState, ($state) => $state.speed);
export const isPaused = derived(gameState, ($state) => $state.isPaused);
export const managementState = derived(gameState, ($state) => $state.management);
export const financeState = derived(gameState, ($state) => $state.finance);

export const balanceLabel = derived(balance, ($balance) => formatCurrency($balance));
export const centralBankRateLabel = derived(centralBankRate, ($rate) => `${($rate * 100).toFixed(2)}%`);

export const monthlyCashFlowLabel = derived(gameState, ($state) => {
  const grossRent = $state.portfolio.reduce(
    (sum, property) => sum + (property.tenant?.monthlyRent ?? property.monthlyRentEstimate ?? 0),
    0
  );
  const mortgage = $state.portfolio.reduce(
    (sum, property) => sum + (property.mortgage?.monthlyPayment ?? 0),
    0
  );
  const net = computeMonthlyCashFlow($state);
  const label = `${formatCurrency(net)} <small class="text-muted">(rent ${formatCurrency(
    grossRent
  )} - mortgages ${formatCurrency(mortgage)})</small>`;
  return label;
});

function buildLocationSummary(property: GameProperty): string {
  const location = property.location ?? {};
  const transit = Math.round((location.proximity ?? 0) * 100);
  const schools = location.schoolRating ?? '-';
  const crime = location.crimeScore ?? '-';
  return `<strong>Location:</strong> ${property.locationDescriptor} · Transit ${transit}% · Schools ${schools}/10 · Crime score ${crime}/10`;
}

function formatMaintenanceLabel(property: GameProperty): string {
  return `${Math.round(property.maintenancePercent)}% condition`;
}

function formatRentSummary(property: GameProperty): string {
  if (property.tenant) {
    const months = property.tenant.leaseMonthsRemaining;
    return `<strong>Current rent:</strong> ${formatCurrency(property.tenant.monthlyRent)} <span class="text-muted">(${months} months remaining)</span>`;
  }
  return `<strong>Projected rent:</strong> ${formatCurrency(property.monthlyRentEstimate)} <span class="text-muted">(based on demand)</span>`;
}

function buildStatusChips(property: GameProperty): { label: string; variant?: string }[] {
  const chips: { label: string; variant?: string }[] = [];
  if (property.tenant) {
    chips.push({ label: `Tenant in place (${property.tenant.leaseMonthsRemaining} months remaining)`, variant: 'bg-success' });
  } else {
    chips.push({ label: 'Vacant', variant: 'bg-secondary' });
  }
  if (property.rentalMarketingPausedForMaintenance) {
    chips.push({ label: 'Marketing paused', variant: 'bg-warning text-dark' });
  } else if (!property.tenant) {
    chips.push({ label: 'Advertising', variant: 'bg-warning text-dark' });
  }
  if (property.autoRelist) {
    chips.push({ label: 'Auto-relist on', variant: 'bg-info text-dark' });
  }
  return chips;
}

export const propertyCards = derived(gameState, ($state): PropertyCard[] => {
  const cards: PropertyCard[] = [];
  const ownedIds = new Set($state.portfolio.map((property) => property.id));

  $state.portfolio.forEach((property) => {
    cards.push({
      id: property.id,
      name: property.name,
      description: property.description,
      summaryHtml: `<strong>${property.bedrooms}</strong> bed · <strong>${property.bathrooms}</strong> bath · ${formatPropertyType(property.propertyType)}`,
      featureTags: property.features,
      locationDetailsHtml: buildLocationSummary(property),
      maintenanceLabel: formatMaintenanceLabel(property),
      maintenancePercent: property.maintenancePercent,
      demandHtml: `<strong>Demand:</strong> ${property.demandScore}/10`,
      costHtml: `<strong>Value:</strong> ${formatCurrency(property.cost)}`,
      rentHtml: formatRentSummary(property),
      statusChips: buildStatusChips(property),
      owned: true,
      disablePurchase: true,
      manageLabel: 'Manage lease'
    });
  });

  $state.market.forEach((property) => {
    cards.push({
      id: property.id,
      name: property.name,
      description: property.description,
      summaryHtml: `<strong>${property.bedrooms}</strong> bed · <strong>${property.bathrooms}</strong> bath · ${formatPropertyType(property.propertyType)}`,
      featureTags: property.features,
      locationDetailsHtml: buildLocationSummary(property),
      maintenanceLabel: formatMaintenanceLabel(property),
      maintenancePercent: property.maintenancePercent,
      demandHtml: `<strong>Demand:</strong> ${property.demandScore}/10`,
      costHtml: `<strong>Cost:</strong> ${formatCurrency(property.cost)}`,
      rentHtml: formatRentSummary(property),
      statusChips: buildStatusChips(property),
      owned: false,
      disablePurchase:
        ownedIds.has(property.id) || property.cost * Math.min($state.finance.depositRatio, MINIMUM_DEPOSIT_RATIO) > $state.balance,
      manageLabel: 'Inspect'
    });
  });

  return cards;
});

export const rentalItems = derived(gameState, ($state): RentalItem[] =>
  $state.portfolio.map((property) => {
    if (property.tenant) {
      const net = property.tenant.monthlyRent - (property.mortgage?.monthlyPayment ?? 0);
      const netLabel = net >= 0 ? 'Positive cash flow' : 'Negative cash flow';
      const netClass = net >= 0 ? 'text-success' : 'text-danger';
      return {
        id: `rental-${property.id}`,
        contentHtml: `<strong>${property.name}:</strong> Lease ${property.tenant.leaseMonthsRemaining} months remaining. Monthly rent ${formatCurrency(
          property.tenant.monthlyRent
        )}. <span class="${netClass}">${netLabel} ${formatCurrency(net)}</span>`
      };
    }
    return {
      id: `rental-${property.id}`,
      contentHtml: `<strong>${property.name}:</strong> Vacant — marketing ongoing. Expected rent ${formatCurrency(
        property.monthlyRentEstimate
      )}.`
    };
  })
);

export const historyEntries = derived(history, ($history): HistoryEntry[] =>
  $history
    .slice()
    .reverse()
    .map((entry) => ({
      id: entry.id,
      contentHtml: `<code>[Day ${entry.day}]</code> ${entry.message}`
    }))
);

export const speedLabel = derived(speed, ($speed) => $speed.toString());

export const managementView = derived(gameState, ($state) => {
  if (!$state.management.open || !$state.management.propertyId) {
    return {
      open: false,
      activeSection: 'overview',
      subtitle: '',
      summaryHtml: '',
      overviewHtml: '',
      leasingHtml: '',
      financingHtml: '',
      transactionsHtml: '',
      maintenanceHtml: ''
    };
  }
  const property =
    $state.portfolio.find((item) => item.id === $state.management.propertyId) ??
    $state.market.find((item) => item.id === $state.management.propertyId);
  if (!property) {
    return {
      open: false,
      activeSection: 'overview',
      subtitle: '',
      summaryHtml: '',
      overviewHtml: '',
      leasingHtml: '',
      financingHtml: '',
      transactionsHtml: '',
      maintenanceHtml: ''
    };
  }

  const netCash = (property.tenant?.monthlyRent ?? 0) - (property.mortgage?.monthlyPayment ?? 0);
  const netClass = netCash >= 0 ? 'text-success' : 'text-danger';
  const summaryHtml = `
    <div class="metric">
      <span class="label">Gross rent</span>
      <span class="value">${formatCurrency(property.tenant?.monthlyRent ?? property.monthlyRentEstimate)}</span>
    </div>
    <div class="metric">
      <span class="label">Occupancy</span>
      <span class="value">${property.tenant ? 'Tenant in place' : 'Vacant'}</span>
    </div>
    <div class="metric">
      <span class="label">Net cash flow</span>
      <span class="value ${netClass}">${formatCurrency(netCash)}</span>
    </div>
  `;

  const overviewHtml = `
    <div class="section-card">
      <h6>Performance snapshot</h6>
      <p class="mb-2">Market value: <strong>${formatCurrency(property.cost)}</strong></p>
      <p class="mb-2">Maintenance level: <strong>${formatPercent(property.maintenancePercent)}</strong></p>
      <p class="mb-0">Demand score: <strong>${property.demandScore}/10</strong></p>
    </div>
  `;

  const leasingHtml = `
    <div class="section-card">
      <h6>Leasing status</h6>
      <p class="mb-2">${property.tenant ? 'Tenant secured' : 'Vacant — marketing active'}.</p>
      <p class="mb-0">Expected monthly rent: <strong>${formatCurrency(
        property.monthlyRentEstimate
      )}</strong></p>
    </div>
  `;

  const financingHtml = property.mortgage
    ? `
        <div class="section-card">
          <h6>Mortgage details</h6>
          <p class="mb-2">Outstanding balance: <strong>${formatCurrency(property.mortgage.principal)}</strong></p>
          <p class="mb-2">Monthly payment: <strong>${formatCurrency(property.mortgage.monthlyPayment)}</strong></p>
          <p class="mb-0">Rate: <strong>${formatInterestRate(property.mortgage.annualInterestRate)}</strong></p>
        </div>
      `
    : `
        <div class="section-card">
          <h6>Financing</h6>
          <p class="mb-0">No mortgage in place. Purchase financing is available from the property list.</p>
        </div>
      `;

  const transactionsHtml = `
    <div class="section-card">
      <h6>Transactions</h6>
      <p class="mb-0">Purchase and sale history for ${property.name} will appear here.</p>
    </div>
  `;

  const maintenanceHtml = `
    <div class="section-card">
      <h6>Maintenance</h6>
      <p class="mb-2">Current condition: <strong>${formatPercent(property.maintenancePercent)}</strong></p>
      <p class="mb-0">Schedule refurbishments once the maintenance level falls below ${formatPercent(
        MAINTENANCE_CONFIG.criticalThreshold
      )}.</p>
    </div>
  `;

  return {
    open: true,
    activeSection: $state.management.activeSection,
    subtitle: property.name,
    summaryHtml,
    overviewHtml,
    leasingHtml,
    financingHtml,
    transactionsHtml,
    maintenanceHtml
  };
});

export const financeView = derived(gameState, ($state) => {
  if (!$state.finance.open || !$state.finance.propertyId) {
    return {
      open: false,
      propertyName: '',
      propertySummary: '',
      depositOptionsHtml: '',
      fixedPeriodOptionsHtml: '',
      termOptionsHtml: '',
      paymentTypeOptionsHtml: '',
      paymentPreviewHtml: '',
      affordabilityNoteHtml: ''
    };
  }
  const property = $state.market.find((item) => item.id === $state.finance.propertyId);
  if (!property) {
    return {
      open: false,
      propertyName: '',
      propertySummary: '',
      depositOptionsHtml: '',
      fixedPeriodOptionsHtml: '',
      termOptionsHtml: '',
      paymentTypeOptionsHtml: '',
      paymentPreviewHtml: '',
      affordabilityNoteHtml: ''
    };
  }

  const depositOptionsHtml = FINANCE_CONFIG.depositOptions
    .map((ratio) => {
      const isActive = Math.abs(ratio - $state.finance.depositRatio) < 1e-6;
      return `
        <button type="button" class="btn btn-outline-primary${isActive ? ' active' : ''}" data-deposit-ratio="${ratio}" aria-pressed="${isActive}">
          ${Math.round(ratio * 100)}%
        </button>
      `;
    })
    .join('');

  const termOptionsHtml = FINANCE_CONFIG.termOptions
    .map((years) => {
      const isActive = years === $state.finance.termYears;
      return `
        <button type="button" class="btn btn-outline-primary${isActive ? ' active' : ''}" data-term-years="${years}" aria-pressed="${isActive}">
          ${years} years
        </button>
      `;
    })
    .join('');

  const fixedPeriodOptionsHtml = FINANCE_CONFIG.fixedPeriodOptions
    .map((years) => {
      const disabled = years > $state.finance.termYears;
      const isActive = years === $state.finance.fixedPeriodYears && !disabled;
      return `
        <button type="button" class="btn btn-outline-primary${isActive ? ' active' : ''}" data-fixed-period-years="${years}" aria-pressed="${isActive}" ${disabled ? 'disabled' : ''}>
          ${years} years
        </button>
      `;
    })
    .join('');

  const paymentTypeOptionsHtml = `
    <button type="button" class="btn btn-outline-secondary${$state.finance.interestOnly ? '' : ' active'}" data-interest-only="false" aria-pressed="${$state.finance.interestOnly ? 'false' : 'true'}">Repayment</button>
    <button type="button" class="btn btn-outline-secondary${$state.finance.interestOnly ? ' active' : ''}" data-interest-only="true" aria-pressed="${$state.finance.interestOnly ? 'true' : 'false'}">Interest-only</button>
  `;

  const mortgagePreview = createMortgage(property, $state);
  const canAffordDeposit = $state.balance >= mortgagePreview.deposit;
  const paymentPreviewHtml = `
    <p class="mb-2">Purchase price: <strong>${formatCurrency(property.cost)}</strong></p>
    <p class="mb-2">Deposit: <strong>${formatCurrency(mortgagePreview.deposit)} (${Math.round(
      mortgagePreview.depositRatio * 100
    )}%)</strong></p>
    <p class="mb-2">Monthly payment: <strong>${formatCurrency(mortgagePreview.monthlyPayment)}</strong></p>
    <p class="mb-0">Fixed rate: <strong>${formatInterestRate(mortgagePreview.annualInterestRate)}</strong></p>
  `;

  const affordabilityNoteHtml = canAffordDeposit
    ? '<span class="text-success">Deposit affordable with current balance.</span>'
    : `<span class="text-danger">Insufficient funds for the selected deposit. You need ${formatCurrency(
        mortgagePreview.deposit
      )}.</span>`;

  const validationHtml = $state.finance.validationError
    ? `<div class="alert alert-danger mt-2" role="alert">${$state.finance.validationError}</div>`
    : '';

  return {
    open: true,
    propertyName: property.name,
    propertySummary: `<strong>${property.bedrooms}</strong> bed · <strong>${property.bathrooms}</strong> bath · ${formatPropertyType(property.propertyType)}`,
    depositOptionsHtml,
    fixedPeriodOptionsHtml,
    termOptionsHtml,
    paymentTypeOptionsHtml,
    paymentPreviewHtml,
    affordabilityNoteHtml: `${affordabilityNoteHtml}${validationHtml}`
  };
});

function createStateWithInitialHistory(logResetMessage: boolean): GameState {
  let state = createInitialState();
  if (logResetMessage) {
    state = addHistory(state, 'Game reset. Starting over with fresh capital.');
  }
  state = addHistory(state, 'New game started with $1,000 in capital.');
  state = addHistory(
    state,
    `Central bank base rate set at ${(state.centralBankRate * 100).toFixed(2)}% to start the simulation.`
  );
  return state;
}

export function initialiseGame(): void {
  gameState.set(createStateWithInitialHistory(false));
}

export function resetGame(): void {
  gameState.set(createStateWithInitialHistory(true));
}

export function setGameSpeed(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  gameState.update((state) => {
    const speedMultiplier = (1000 / value).toFixed(1);
    return addHistory({ ...state, speed: value }, `Game speed set to ${speedMultiplier}x.`);
  });
}

export function tickDay(): void {
  gameState.update((state) => {
    let nextState = { ...state, day: state.day + 1 };
    nextState = degradeAllProperties(nextState);
    if (nextState.day - nextState.lastRentCollectionDay >= 30) {
      nextState = processMonthlyTick(nextState);
    }
    nextState = adjustCentralBankRateIfNeeded(nextState);
    return nextState;
  });
}

export function pauseGame(): void {
  gameState.update((state) => ({ ...state, isPaused: true }));
}

export function resumeGame(): void {
  gameState.update((state) => ({ ...state, isPaused: false }));
}

export function openManagement(propertyId: string): void {
  gameState.update((state) => ({
    ...state,
    management: {
      ...state.management,
      open: true,
      propertyId,
      activeSection: 'overview'
    }
  }));
}

export function closeManagement(): void {
  gameState.update((state) => ({
    ...state,
    management: {
      ...state.management,
      open: false,
      propertyId: null
    }
  }));
}

export function setManagementSection(section: ManagementState['activeSection']): void {
  gameState.update((state) => ({
    ...state,
    management: {
      ...state.management,
      activeSection: section
    }
  }));
}

export function openFinance(propertyId: string): void {
  gameState.update((state) => ({
    ...state,
    finance: {
      ...state.finance,
      open: true,
      propertyId,
      depositRatio: FINANCE_CONFIG.defaultDepositRatio,
      termYears: FINANCE_CONFIG.defaultTermYears,
      fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
      interestOnly: false,
      validationError: null
    }
  }));
}

export function closeFinance(): void {
  gameState.update((state) => ({
    ...state,
    finance: {
      ...state.finance,
      open: false,
      propertyId: null,
      validationError: null
    }
  }));
}

export function selectFinanceDeposit(ratio: number): void {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return;
  }
  gameState.update((state) => ({
    ...state,
    finance: {
      ...state.finance,
      depositRatio: ratio,
      validationError: null
    }
  }));
}

export function selectFinanceTerm(years: number): void {
  if (!Number.isFinite(years) || years <= 0) {
    return;
  }
  gameState.update((state) => ({
    ...state,
    finance: {
      ...state.finance,
      termYears: years,
      fixedPeriodYears: Math.min(state.finance.fixedPeriodYears, years),
      validationError: null
    }
  }));
}

export function selectFinanceFixedPeriod(years: number): void {
  if (!Number.isFinite(years) || years <= 0) {
    return;
  }
  gameState.update((state) => ({
    ...state,
    finance: {
      ...state.finance,
      fixedPeriodYears: Math.min(years, state.finance.termYears),
      validationError: null
    }
  }));
}

export function setFinanceInterestOnly(value: boolean): void {
  gameState.update((state) => ({
    ...state,
    finance: {
      ...state.finance,
      interestOnly: value,
      validationError: null
    }
  }));
}

export function confirmFinance(): void {
  const state = get(gameState);
  if (!state.finance.propertyId) {
    return;
  }
  const property = state.market.find((item) => item.id === state.finance.propertyId);
  if (!property) {
    closeFinance();
    return;
  }
  const mortgage = createMortgage(property, state);
  if (mortgage.deposit > state.balance) {
    gameState.update((current) => ({
      ...current,
      finance: { ...current.finance, validationError: 'Insufficient funds for the selected deposit.' }
    }));
    return;
  }

  const updatedProperty: GameProperty = {
    ...property,
    mortgage,
    tenant: null
  };

  let nextState: GameState = {
    ...state,
    balance: state.balance - mortgage.deposit,
    market: state.market.filter((item) => item.id !== property.id),
    portfolio: [...state.portfolio, updatedProperty],
    finance: {
      ...state.finance,
      open: false,
      propertyId: null,
      validationError: null
    }
  };

  nextState = addHistory(
    nextState,
    `Purchased ${property.name} with ${Math.round(mortgage.depositRatio * 100)}% deposit. Monthly payment ${formatCurrency(
      mortgage.monthlyPayment
    )}.`
  );

  gameState.set(nextState);
}

export function cancelFinance(): void {
  closeFinance();
}

export function purchaseProperty(propertyId: string): void {
  openFinance(propertyId);
}

export function manageProperty(propertyId: string): void {
  openManagement(propertyId);
}

