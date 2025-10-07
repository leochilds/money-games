import { derived, get, writable } from 'svelte/store';
import {
  FINANCE_CONFIG,
  MAINTENANCE_CONFIG,
  MARKET_CONFIG,
  defaultProperties,
  featureAddOns as FEATURE_ADD_ONS,
  proceduralPropertyArchetypes,
  propertyTypeMultipliers,
  type PropertyDefinition
} from '$lib/config';
import type { HistoryEntry, PropertyCard, RentalItem } from '$lib/types';
import {
  formatCurrency,
  formatInterestRate,
  formatLeaseCountdown,
  formatPercentage,
  formatPropertyType,
  getRandomInt,
  getRandomNumber,
  pickRandom,
  roundCurrency,
  selectFeatureSubset
} from '$lib/utils';

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

type MaintenanceWorkOrder = {
  monthsRemaining: number;
  cost: number;
  scheduledOnDay: number;
  startDelayMonths: number;
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
  maintenanceWork: MaintenanceWorkOrder | null;
  marketAge: number;
  introducedOnDay: number;
  vacancyMonths: number;
};

export type ManagementLeasingControls = {
  plans: {
    id: string;
    label: string;
    leaseMonths: number;
    rateOffset: number;
    monthlyRent: number;
    probability: number;
  }[];
  leaseMonthsOptions: number[];
  rentPremiumOptions: { value: number; label: string }[];
  selectedPlanId: string;
  selectedLeaseMonths: number;
  selectedRateOffset: number;
  autoRelist: boolean;
  marketingPaused: boolean;
  hasTenant: boolean;
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

export type ManagementMaintenanceState = {
  maintenancePercent: number;
  projectedCost: number;
  projectedPercent: number;
  tenantMonthsRemaining: number;
  leaseCountdownLabel: string | null;
  work: MaintenanceWorkOrder | null;
  workDelayMonths: number;
  workIsActive: boolean;
  maintenanceThreshold: number;
  canSchedule: boolean;
  reasons: {
    atMaxMaintenance: boolean;
    alreadyScheduled: boolean;
    insufficientFunds: boolean;
  };
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
  lastMarketGenerationDay: number;
  lastRentCollectionDay: number;
  finance: FinanceState;
  management: ManagementState;
};

const MINIMUM_DEPOSIT_RATIO = Math.min(...FINANCE_CONFIG.depositOptions);

const RENT_RATE_OFFSETS = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1];
const LEASE_LENGTH_CHOICES = [6, 12, 18, 24, 36];

let historyIdCounter = 1;

function createEmptyLeasingControls(): ManagementLeasingControls {
  return {
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
}

export function createEmptyMaintenanceState(): ManagementMaintenanceState {
  return {
    maintenancePercent: 0,
    projectedCost: 0,
    projectedPercent: 0,
    tenantMonthsRemaining: 0,
    leaseCountdownLabel: null,
    work: null,
    workDelayMonths: 0,
    workIsActive: false,
    maintenanceThreshold: MAINTENANCE_CONFIG.criticalThreshold,
    canSchedule: false,
    reasons: {
      atMaxMaintenance: false,
      alreadyScheduled: false,
      insufficientFunds: false
    }
  };
}

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

function clampDemandScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 5;
  }
  return Math.min(Math.max(score, 1), 10);
}

function mapDemandToAnnualYield(demandScore: number): number {
  const minYield = 0.03;
  const maxYield = 0.08;
  const clamped = clampDemandScore(demandScore);
  const progression = (clamped - 1) / 9;
  return minYield + progression * (maxYield - minYield);
}

function getTenantMonthsRemaining(property: GameProperty): number {
  const remaining = property.tenant?.leaseMonthsRemaining ?? 0;
  if (!Number.isFinite(remaining)) {
    return 0;
  }
  return Math.max(Math.round(remaining), 0);
}

function forecastMaintenancePercent(
  property: GameProperty,
  options: { maintenancePercent?: number; delayMonths?: number } = {}
): number {
  const { maintenancePercent, delayMonths } = options;
  let baseCandidate: number;
  if (Number.isFinite(maintenancePercent)) {
    baseCandidate = maintenancePercent ?? 0;
  } else if (Number.isFinite(property.maintenancePercent)) {
    baseCandidate = property.maintenancePercent;
  } else {
    const [minPercent, maxPercent] = MAINTENANCE_CONFIG.initialPercentRange;
    baseCandidate = Number.isFinite(maxPercent)
      ? maxPercent
      : Number.isFinite(minPercent)
        ? minPercent
        : 100;
  }
  const currentPercent = clampMaintenancePercent(baseCandidate);
  const delay = Number.isFinite(delayMonths) ? Math.max(delayMonths ?? 0, 0) : getTenantMonthsRemaining(property);
  if (delay <= 0) {
    return currentPercent;
  }
  const occupiedDecay = MAINTENANCE_CONFIG.occupiedDecayPerMonth ?? 0;
  const projected = currentPercent - occupiedDecay * delay;
  return clampMaintenancePercent(projected);
}

function estimateMaintenanceCost(
  property: GameProperty,
  options: { delayMonths?: number } = {}
): { baseValue: number; projectedCost: number; projectedPercent: number; deficiencyRatio: number } {
  if (!property) {
    return { baseValue: 0, projectedCost: 0, projectedPercent: 0, deficiencyRatio: 0 };
  }
  const baseValue = Number.isFinite(property.baseValue) ? property.baseValue : calculatePropertyValue(property);
  const projectedPercent = forecastMaintenancePercent(property, { delayMonths: options.delayMonths });
  const deficiencyRatio = Math.max(0, 100 - projectedPercent) / 100;
  const costRatio = MAINTENANCE_CONFIG.refurbishmentCostRatio ?? 0.25;
  const projectedCost = Math.round(baseValue * costRatio * deficiencyRatio);
  return { baseValue, projectedCost, projectedPercent, deficiencyRatio };
}

function getInitialMaintenancePercent(preferred?: number): number {
  if (Number.isFinite(preferred)) {
    return clampMaintenancePercent(preferred);
  }
  const [minPercent, maxPercent] = MAINTENANCE_CONFIG.initialPercentRange;
  return clampMaintenancePercent((minPercent + maxPercent) / 2);
}

function deriveMaintenancePercent(
  range: readonly [number, number] | undefined,
  fallback: number
): number {
  if (Array.isArray(range) && range.length === 2) {
    const [min, max] = range;
    const lower = Number.isFinite(min) ? min : fallback;
    const upper = Number.isFinite(max) ? max : fallback;
    if (Number.isFinite(lower) && Number.isFinite(upper) && lower < upper) {
      return clampMaintenancePercent(getRandomInt(lower, upper));
    }
  }
  return getInitialMaintenancePercent(fallback);
}

function createInitialProperty(definition: PropertyDefinition, day = 1): GameProperty {
  const baseValue = calculatePropertyValue(definition);
  const maintenancePercent = getInitialMaintenancePercent(definition.maintenancePercent);
  const cost = calculateMaintenanceAdjustedValue(baseValue, maintenancePercent);
  const monthlyRentEstimate = calculateMonthlyRentEstimate(cost, definition.demandScore);
  const placeholder: GameProperty = {
    ...definition,
    baseValue,
    cost,
    maintenancePercent,
    monthlyRentEstimate,
    rentPlanId: '',
    tenant: null,
    mortgage: null,
    autoRelist: true,
    rentalMarketingPausedForMaintenance: false,
    maintenanceWork: null,
    marketAge: 0,
    introducedOnDay: day,
    vacancyMonths: 0
  };

  const plans = getRentStrategies(placeholder, FINANCE_CONFIG.centralBank.initialRate);
  const preferredPlan =
    plans.find(
      (plan) =>
        plan.leaseMonths === LEASE_LENGTH_CHOICES[1] &&
        Math.abs(plan.rateOffset - RENT_RATE_OFFSETS[1]) < 1e-6
    ) ?? plans[0];
  const rentPlanId = preferredPlan?.id ?? buildRentPlanId(LEASE_LENGTH_CHOICES[1], RENT_RATE_OFFSETS[1]);

  return { ...placeholder, rentPlanId };
}

function generateProceduralPropertyId(): string {
  const cryptoApi =
    typeof globalThis !== 'undefined'
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `proc-${cryptoApi.randomUUID()}`;
  }
  return `proc-${Math.random().toString(36).slice(2, 10)}`;
}

function createProceduralProperty(state: GameState): GameProperty {
  const archetype = pickRandom(proceduralPropertyArchetypes);
  const bedrooms = getRandomInt(archetype.bedroomsRange[0], archetype.bedroomsRange[1]);
  const bathrooms = getRandomInt(archetype.bathroomsRange[0], archetype.bathroomsRange[1]);
  const demandScore = getRandomInt(archetype.demandRange[0], archetype.demandRange[1]);
  const location = {
    proximity: getRandomNumber(archetype.proximityRange[0], archetype.proximityRange[1], 2),
    schoolRating: getRandomInt(archetype.schoolRange[0], archetype.schoolRange[1]),
    crimeScore: getRandomInt(archetype.crimeRange[0], archetype.crimeRange[1])
  };

  const baseDefinition: PropertyDefinition = {
    id: generateProceduralPropertyId(),
    name: pickRandom(archetype.names),
    description: pickRandom(archetype.descriptions),
    propertyType: archetype.propertyType,
    bedrooms,
    bathrooms,
    features: selectFeatureSubset(archetype.featuresPool),
    locationDescriptor: pickRandom(archetype.locationDescriptors),
    demandScore,
    location
  };

  const baseValue = calculatePropertyValue(baseDefinition);
  const maintenanceBaseline = getInitialMaintenancePercent();
  const maintenancePercent = deriveMaintenancePercent(archetype.maintenancePercentRange, maintenanceBaseline);
  const cost = calculateMaintenanceAdjustedValue(baseValue, maintenancePercent);
  const monthlyRentEstimate = calculateMonthlyRentEstimate(cost, demandScore);

  const provisional: GameProperty = {
    ...baseDefinition,
    baseValue,
    cost,
    maintenancePercent,
    monthlyRentEstimate,
    rentPlanId: '',
    tenant: null,
    mortgage: null,
    autoRelist: true,
    rentalMarketingPausedForMaintenance: false,
    maintenanceWork: null,
    marketAge: 0,
    introducedOnDay: state.day,
    vacancyMonths: 0
  };

  const plans = getRentStrategies(provisional, state.centralBankRate);
  const targetPlan =
    plans.find(
      (plan) =>
        plan.leaseMonths === LEASE_LENGTH_CHOICES[1] &&
        Math.abs(plan.rateOffset - RENT_RATE_OFFSETS[1]) < 1e-6
    ) ?? plans[0];
  const rentPlanId = targetPlan?.id ?? buildRentPlanId(LEASE_LENGTH_CHOICES[1], RENT_RATE_OFFSETS[1]);

  const inheritedChance = 0.25 + (clampDemandScore(demandScore) / 10) * 0.35;
  const hasInheritedTenant = Math.random() < Math.min(Math.max(inheritedChance, 0), 0.75);

  let tenant: Tenant | null = null;
  let vacancyMonths = 0;
  if (hasInheritedTenant) {
    const planForTenant = targetPlan ?? plans[0] ?? null;
    const tenantRent = planForTenant
      ? planForTenant.monthlyRent
      : Math.round((cost * mapDemandToAnnualYield(demandScore)) / 12);
    const baseLease = planForTenant?.leaseMonths ?? 12;
    const minLease = Math.max(baseLease - 3, 6);
    const maxLease = baseLease + 6;
    const leaseMonths = getRandomInt(minLease, maxLease);
    tenant = {
      leaseMonthsRemaining: leaseMonths,
      monthlyRent: tenantRent
    };
    vacancyMonths = 0;
  } else {
    vacancyMonths = getRandomInt(0, 2);
  }

  return {
    ...provisional,
    rentPlanId,
    tenant,
    vacancyMonths
  };
}

function generateMarketListings(
  state: GameState,
  count = 1
): { state: GameState; newListings: GameProperty[] } {
  if (state.market.length >= MARKET_CONFIG.maxSize) {
    return { state, newListings: [] };
  }

  const slotsAvailable = Math.max(MARKET_CONFIG.maxSize - state.market.length, 0);
  const listingsToGenerate = Math.min(count, slotsAvailable);
  if (listingsToGenerate <= 0) {
    return { state, newListings: [] };
  }

  const newListings: GameProperty[] = [];
  const market = [...state.market];
  for (let index = 0; index < listingsToGenerate; index += 1) {
    const property = createProceduralProperty(state);
    newListings.push(property);
    market.push(property);
  }

  return { state: { ...state, market }, newListings };
}

function progressMarketListings(state: GameState): GameState {
  const retained: GameProperty[] = [];
  const expired: GameProperty[] = [];

  state.market.forEach((property) => {
    const currentAge = (property.marketAge ?? 0) + 1;
    if (currentAge > MARKET_CONFIG.maxAge) {
      expired.push(property);
      return;
    }
    retained.push({ ...property, marketAge: currentAge });
  });

  let nextState: GameState = { ...state, market: retained };

  if (expired.length > 0) {
    const removedNames = expired.map((property) => property.name).join(', ');
    const message =
      expired.length > 1
        ? `Listings expired and left the market: ${removedNames}.`
        : `Listing expired and left the market: ${removedNames}.`;
    nextState = addHistory(nextState, message);
  }

  const daysSinceGeneration = nextState.day - nextState.lastMarketGenerationDay;
  const spaceAvailable = Math.max(MARKET_CONFIG.maxSize - nextState.market.length, 0);
  const readyForNewListings = daysSinceGeneration >= MARKET_CONFIG.generationInterval;

  let requiredListings = 0;
  if (readyForNewListings && spaceAvailable > 0) {
    const minimumShortfall = Math.max(MARKET_CONFIG.minSize - nextState.market.length, 0);
    if (minimumShortfall > 0) {
      requiredListings = minimumShortfall;
    } else {
      const batchSize = Math.max(MARKET_CONFIG.batchSize, 1);
      requiredListings = getRandomInt(1, batchSize);
    }
  }

  const listingsNeeded = Math.min(requiredListings, spaceAvailable);
  if (listingsNeeded > 0) {
    const result = generateMarketListings(nextState, listingsNeeded);
    nextState = result.state;
    if (result.newListings.length > 0) {
      const newNames = result.newListings.map((property) => property.name).join(', ');
      const message =
        result.newListings.length > 1
          ? `New listings have entered the market: ${newNames}.`
          : `New listing has entered the market: ${newNames}.`;
      nextState = addHistory(nextState, message);
      nextState = { ...nextState, lastMarketGenerationDay: nextState.day };
    }
  }

  return nextState;
}

function buildRentPlanId(leaseMonths: number, rateOffset: number): string {
  const rateKey = Math.round(rateOffset * 1000);
  return `lease-${leaseMonths}-rate-${rateKey}`;
}

function findRentPlan(
  property: GameProperty,
  rentPlanId: string,
  baseRate?: number
): RentPlan | undefined {
  const plans = getRentStrategies(property, baseRate);
  return plans.find((plan) => plan.id === rentPlanId);
}

function formatRentPremiumLabel(rateOffset: number): string {
  return `${(rateOffset * 100).toFixed(1)}%`;
}

function calculateTenantProbability(
  property: GameProperty,
  leaseMonths: number,
  rateOffset: number
): number {
  const demandScore = clampDemandScore(property?.demandScore ?? 5);
  const baseProbability = Math.min(0.2 + (demandScore / 10) * 0.6, 0.95);

  const rentIndex = Math.max(RENT_RATE_OFFSETS.indexOf(rateOffset), 0);
  const rentRatio = RENT_RATE_OFFSETS.length > 1 ? rentIndex / (RENT_RATE_OFFSETS.length - 1) : 0;
  const rentFactor = Math.max(1 - rentRatio * 0.5, 0.35);

  const leaseIndex = Math.max(LEASE_LENGTH_CHOICES.indexOf(leaseMonths), 0);
  const leaseRatio = LEASE_LENGTH_CHOICES.length > 1 ? leaseIndex / (LEASE_LENGTH_CHOICES.length - 1) : 0;

  let leaseFactor = 1;
  if (rateOffset < 0.05) {
    leaseFactor += (leaseRatio - 0.5) * 0.4;
  } else if (rateOffset > 0.06) {
    leaseFactor += (0.5 - leaseRatio) * 0.4;
  }

  const probability = Math.min(
    Math.max(baseProbability * rentFactor * Math.max(leaseFactor, 0.6), 0.05),
    0.95
  );

  return Math.round(probability * 1000) / 1000;
}

export function getRentStrategies(property: GameProperty, baseRate?: number): RentPlan[] {
  const defaultBaseRate = FINANCE_CONFIG?.centralBank?.initialRate ?? 0;
  const baseRateCandidate = Number.isFinite(baseRate) ? baseRate : defaultBaseRate;
  const effectiveBaseRate = Math.max(baseRateCandidate ?? 0, 0);

  return LEASE_LENGTH_CHOICES.flatMap((leaseMonths) =>
    RENT_RATE_OFFSETS.map((rateOffset) => {
      const annualRate = Math.max(effectiveBaseRate + rateOffset, 0.001);
      const monthlyRent = roundCurrency((property.cost * annualRate) / 12);
      const probability = calculateTenantProbability(property, leaseMonths, rateOffset);

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
  if (Math.abs(updatedPercent - property.maintenancePercent) < 1e-6) {
    return property;
  }
  const cost = calculateMaintenanceAdjustedValue(property.baseValue, updatedPercent);
  const monthlyRentEstimate = calculateMonthlyRentEstimate(cost, property.demandScore);
  return { ...property, maintenancePercent: updatedPercent, cost, monthlyRentEstimate };
}

function processMonthlyTick(state: GameState): GameState {
  let nextState: GameState = { ...state };
  let balanceChange = 0;
  const updatedPortfolio = nextState.portfolio.map((property) => {
    let updated = { ...property };
    const historyMessages: string[] = [];

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
    } else if (updated.rentalMarketingPausedForMaintenance) {
      historyMessages.push(`Marketing remains paused at ${updated.name} while maintenance is underway.`);
    } else if (!updated.autoRelist) {
      historyMessages.push(`Auto-relisting is disabled for ${updated.name}; no tenants were sourced this month.`);
    } else {
      const plans = getRentStrategies(updated, state.centralBankRate);
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

    let work = updated.maintenanceWork ? { ...updated.maintenanceWork } : null;
    if (work) {
      if (work.startDelayMonths > 0) {
        work.startDelayMonths = Math.max(work.startDelayMonths - 1, 0);
        if (work.startDelayMonths <= 0) {
          work.startDelayMonths = 0;
          work.monthsRemaining = Math.max(work.monthsRemaining ?? 1, 1);
          updated = {
            ...updated,
            tenant: null,
            rentalMarketingPausedForMaintenance: true
          };
          historyMessages.push(
            `Maintenance work began on ${updated.name}. Property unavailable for tenants until work completes.`
          );
        }
      }

      if (!updated.tenant && work.startDelayMonths <= 0) {
        work.monthsRemaining = Math.max((work.monthsRemaining ?? 0) - 1, 0);
        if (work.monthsRemaining <= 0) {
          const completionCost = Math.max(Math.round(work.cost ?? 0), 0);
          const newMaintenancePercent = 100;
          const newCost = calculateMaintenanceAdjustedValue(updated.baseValue, newMaintenancePercent);
          const newRentEstimate = calculateMonthlyRentEstimate(newCost, updated.demandScore);
          const costLabel = completionCost > 0 ? ` at a cost of ${formatCurrency(completionCost)}` : '';
          historyMessages.push(
            `Maintenance completed on ${updated.name}${costLabel}. Condition restored to 100%.`
          );
          balanceChange -= completionCost;
          updated = {
            ...updated,
            maintenancePercent: newMaintenancePercent,
            cost: newCost,
            monthlyRentEstimate: newRentEstimate,
            rentalMarketingPausedForMaintenance: false,
            maintenanceWork: null
          };
          work = null;
        }
      }
    }

    if (work) {
      updated = { ...updated, maintenanceWork: { ...work } };
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
    lastMarketGenerationDay: 0,
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
    const manageAction = {
      type: 'manage' as const,
      label: 'Manage',
      propertyId: property.id,
      ariaLabel: `Manage ${property.name}`
    };
    if (property.tenant) {
      const net = property.tenant.monthlyRent - (property.mortgage?.monthlyPayment ?? 0);
      const netLabel = net >= 0 ? 'Positive cash flow' : 'Negative cash flow';
      const netClass = net >= 0 ? 'text-success' : 'text-danger';
      return {
        id: `rental-${property.id}`,
        propertyId: property.id,
        contentHtml: `<strong>${property.name}:</strong> Lease ${property.tenant.leaseMonthsRemaining} months remaining. Monthly rent ${formatCurrency(
          property.tenant.monthlyRent
        )}. <span class="${netClass}">${netLabel} ${formatCurrency(net)}</span>`,
        actions: [manageAction]
      };
    }
    const marketingMessage = property.rentalMarketingPausedForMaintenance
      ? 'Vacant — marketing paused for maintenance.'
      : property.autoRelist
        ? 'Vacant — marketing ongoing.'
        : 'Vacant — auto-relist disabled.';
    return {
      id: `rental-${property.id}`,
      propertyId: property.id,
      contentHtml: `<strong>${property.name}:</strong> ${marketingMessage} Expected rent ${formatCurrency(
        property.monthlyRentEstimate
      )}.`,
      actions: [manageAction]
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
      maintenanceHtml: '',
      propertyId: '',
      isOwned: false,
      leasingControls: createEmptyLeasingControls(),
      maintenanceState: createEmptyMaintenanceState()
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
      maintenanceHtml: '',
      propertyId: '',
      isOwned: false,
      leasingControls: createEmptyLeasingControls(),
      maintenanceState: createEmptyMaintenanceState()
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

  const rentPlans = getRentStrategies(property, $state.centralBankRate);
  const selectedPlan =
    rentPlans.find((plan) => plan.id === property.rentPlanId) ?? rentPlans[0] ?? null;
  const marketingStatus = property.rentalMarketingPausedForMaintenance
    ? 'Marketing paused for maintenance'
    : property.autoRelist
      ? 'Auto-relist enabled'
      : 'Auto-relist disabled';
  const leasingHtml = `
    <div class="section-card">
      <h6>Leasing status</h6>
      <p class="mb-2">${
        property.tenant
          ? 'Tenant secured and paying rent.'
          : property.rentalMarketingPausedForMaintenance
            ? 'Vacant — marketing is currently paused.'
            : property.autoRelist
              ? 'Vacant — marketing active.'
              : 'Vacant — awaiting marketing instructions.'
      }</p>
      <dl class="row small text-muted mb-0">
        <dt class="col-sm-4">Plan</dt>
        <dd class="col-sm-8">${
          selectedPlan
            ? `${selectedPlan.leaseMonths}-month · ${formatRentPremiumLabel(selectedPlan.rateOffset)} premium`
            : 'Standard listing'
        }</dd>
        <dt class="col-sm-4">Expected rent</dt>
        <dd class="col-sm-8">${
          selectedPlan ? formatCurrency(selectedPlan.monthlyRent) : formatCurrency(property.monthlyRentEstimate)
        }</dd>
        <dt class="col-sm-4">Tenant chance</dt>
        <dd class="col-sm-8">${
          selectedPlan ? formatPercentage(selectedPlan.probability) : '—'
        } per month</dd>
        <dt class="col-sm-4">Marketing</dt>
        <dd class="col-sm-8">${marketingStatus}</dd>
      </dl>
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

  const tenantMonthsRemaining = getTenantMonthsRemaining(property);
  const maintenanceEstimate = estimateMaintenanceCost(property, { delayMonths: tenantMonthsRemaining });
  const maintenanceWork = property.maintenanceWork ? { ...property.maintenanceWork } : null;
  const workDelayMonths = maintenanceWork ? Math.max(maintenanceWork.startDelayMonths ?? 0, 0) : 0;
  const maintenanceState: ManagementMaintenanceState = {
    maintenancePercent: property.maintenancePercent,
    projectedCost: maintenanceEstimate.projectedCost,
    projectedPercent: maintenanceEstimate.projectedPercent,
    tenantMonthsRemaining,
    leaseCountdownLabel: tenantMonthsRemaining > 0 ? formatLeaseCountdown(tenantMonthsRemaining) : null,
    work: maintenanceWork,
    workDelayMonths,
    workIsActive: Boolean(maintenanceWork && workDelayMonths <= 0),
    maintenanceThreshold: MAINTENANCE_CONFIG.criticalThreshold,
    canSchedule:
      !maintenanceWork &&
      property.maintenancePercent < 100 &&
      maintenanceEstimate.projectedCost <= $state.balance,
    reasons: {
      atMaxMaintenance: property.maintenancePercent >= 100,
      alreadyScheduled: Boolean(maintenanceWork),
      insufficientFunds: maintenanceEstimate.projectedCost > $state.balance
    }
  };
  const maintenanceHtml = '';

  const plans = rentPlans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    leaseMonths: plan.leaseMonths,
    rateOffset: plan.rateOffset,
    monthlyRent: plan.monthlyRent,
    probability: plan.probability
  }));
  const leaseMonthsOptions = Array.from(new Set(plans.map((plan) => plan.leaseMonths))).sort((a, b) => a - b);
  const rentPremiumOptions = Array.from(new Set(plans.map((plan) => plan.rateOffset)))
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: formatRentPremiumLabel(value) }));
  const selectedLeaseMonths = selectedPlan?.leaseMonths ?? leaseMonthsOptions[0] ?? 0;
  const selectedRateOffset = selectedPlan?.rateOffset ?? rentPremiumOptions[0]?.value ?? 0;

  return {
    open: true,
    activeSection: $state.management.activeSection,
    subtitle: property.name,
    summaryHtml,
    overviewHtml,
    leasingHtml,
    financingHtml,
    transactionsHtml,
    maintenanceHtml,
    propertyId: property.id,
    isOwned: $state.portfolio.some((item) => item.id === property.id),
    leasingControls: {
      plans,
      leaseMonthsOptions,
      rentPremiumOptions,
      selectedPlanId: selectedPlan?.id ?? '',
      selectedLeaseMonths,
      selectedRateOffset,
      autoRelist: property.autoRelist,
      marketingPaused: property.rentalMarketingPausedForMaintenance,
      hasTenant: Boolean(property.tenant)
    },
    maintenanceState
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
    nextState = progressMarketListings(nextState);
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

function updatePortfolioProperty(
  state: GameState,
  propertyId: string,
  updater: (property: GameProperty) => GameProperty | null
): { state: GameState; property: GameProperty | null; changed: boolean } {
  const index = state.portfolio.findIndex((property) => property.id === propertyId);
  if (index === -1) {
    return { state, property: null, changed: false };
  }
  const property = state.portfolio[index];
  const updated = updater(property);
  if (!updated) {
    return { state, property, changed: false };
  }
  const portfolio = [...state.portfolio];
  portfolio[index] = updated;
  return { state: { ...state, portfolio }, property: updated, changed: true };
}

export function setPropertyLeaseMonths(propertyId: string, leaseMonths: number): void {
  if (!Number.isFinite(leaseMonths) || leaseMonths <= 0) {
    return;
  }
  gameState.update((state) => {
    const result = updatePortfolioProperty(state, propertyId, (property) => {
      const plans = getRentStrategies(property, state.centralBankRate);
      const currentPlan =
        plans.find((plan) => plan.id === property.rentPlanId) ?? plans[0] ?? null;
      if (!currentPlan) {
        return null;
      }
      const targetPlan =
        plans.find(
          (plan) =>
            plan.leaseMonths === leaseMonths && Math.abs(plan.rateOffset - currentPlan.rateOffset) < 1e-6
        ) ?? null;
      if (!targetPlan || targetPlan.id === property.rentPlanId) {
        return null;
      }
      return { ...property, rentPlanId: targetPlan.id };
    });
    if (!result.changed || !result.property) {
      return result.state;
    }
    const plan = findRentPlan(
      result.property,
      result.property.rentPlanId,
      result.state.centralBankRate
    );
    if (!plan) {
      return result.state;
    }
    const message = `Updated ${result.property.name} to a ${plan.leaseMonths}-month lease with a ${formatRentPremiumLabel(plan.rateOffset)} rent premium (expected rent ${formatCurrency(plan.monthlyRent)}).`;
    return addHistory(result.state, message);
  });
}

export function setPropertyRentPremium(propertyId: string, rateOffset: number): void {
  if (!Number.isFinite(rateOffset)) {
    return;
  }
  gameState.update((state) => {
    const result = updatePortfolioProperty(state, propertyId, (property) => {
      const plans = getRentStrategies(property, state.centralBankRate);
      const currentPlan =
        plans.find((plan) => plan.id === property.rentPlanId) ?? plans[0] ?? null;
      if (!currentPlan) {
        return null;
      }
      const targetPlan =
        plans.find(
          (plan) =>
            Math.abs(plan.rateOffset - rateOffset) < 1e-6 && plan.leaseMonths === currentPlan.leaseMonths
        ) ?? null;
      if (!targetPlan || targetPlan.id === property.rentPlanId) {
        return null;
      }
      return { ...property, rentPlanId: targetPlan.id };
    });
    if (!result.changed || !result.property) {
      return result.state;
    }
    const plan = findRentPlan(
      result.property,
      result.property.rentPlanId,
      result.state.centralBankRate
    );
    if (!plan) {
      return result.state;
    }
    const premiumLabel = formatRentPremiumLabel(plan.rateOffset);
    const message = `Adjusted rent premium for ${result.property.name} to ${premiumLabel} (${formatCurrency(plan.monthlyRent)} expected).`;
    return addHistory(result.state, message);
  });
}

export function setPropertyAutoRelist(propertyId: string, enabled: boolean): void {
  gameState.update((state) => {
    const result = updatePortfolioProperty(state, propertyId, (property) => {
      if (property.autoRelist === enabled) {
        return null;
      }
      return { ...property, autoRelist: enabled };
    });
    if (!result.changed || !result.property) {
      return result.state;
    }
    const message = result.property.autoRelist
      ? `Enabled auto-relisting for ${result.property.name}.`
      : `Disabled auto-relisting for ${result.property.name}.`;
    return addHistory(result.state, message);
  });
}

export function setPropertyMarketingPaused(propertyId: string, paused: boolean): void {
  gameState.update((state) => {
    const result = updatePortfolioProperty(state, propertyId, (property) => {
      if (property.rentalMarketingPausedForMaintenance === paused) {
        return null;
      }
      return { ...property, rentalMarketingPausedForMaintenance: paused };
    });
    if (!result.changed || !result.property) {
      return result.state;
    }
    const message = result.property.rentalMarketingPausedForMaintenance
      ? `Paused marketing at ${result.property.name} for maintenance.`
      : `Resumed tenant marketing at ${result.property.name}.`;
    return addHistory(result.state, message);
  });
}

export function schedulePropertyMaintenance(propertyId: string): void {
  gameState.update((state) => {
    const index = state.portfolio.findIndex((property) => property.id === propertyId);
    if (index === -1) {
      return state;
    }
    const property = state.portfolio[index];
    if (property.maintenanceWork) {
      return addHistory(state, `${property.name} already has maintenance scheduled.`);
    }
    if (property.maintenancePercent >= 100) {
      return addHistory(state, `${property.name} is already at 100% maintenance.`);
    }

    const tenantMonthsRemaining = getTenantMonthsRemaining(property);
    const { projectedCost, projectedPercent } = estimateMaintenanceCost(property, {
      delayMonths: tenantMonthsRemaining
    });

    if (projectedCost > state.balance) {
      return addHistory(
        state,
        `Unable to schedule maintenance for ${property.name}: requires ${formatCurrency(projectedCost)} but only ${formatCurrency(state.balance)} is available.`
      );
    }

    const maintenanceWork: MaintenanceWorkOrder = {
      monthsRemaining: 1,
      cost: projectedCost,
      scheduledOnDay: state.day,
      startDelayMonths: tenantMonthsRemaining
    };

    const updatedProperty: GameProperty = {
      ...property,
      maintenanceWork,
      rentalMarketingPausedForMaintenance:
        tenantMonthsRemaining === 0 ? true : property.rentalMarketingPausedForMaintenance
    };

    const portfolio = [...state.portfolio];
    portfolio[index] = updatedProperty;

    let nextState: GameState = { ...state, portfolio };

    const message = tenantMonthsRemaining > 0
      ? `Scheduled maintenance for ${property.name}: work will begin once the current lease ends (${formatLeaseCountdown(tenantMonthsRemaining)} remaining) and will require 1 month of vacancy (estimated cost ${formatCurrency(projectedCost)} based on an expected condition of ${formatPercent(projectedPercent)}).`
      : `Scheduled maintenance for ${property.name}: property will be vacant for 1 month (estimated cost ${formatCurrency(projectedCost)}).`;

    nextState = addHistory(nextState, message);
    return nextState;
  });
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
    mortgage
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

