import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

import { MAINTENANCE_CONFIG, MARKET_CONFIG } from '$lib/config';
import { formatCurrency } from '$lib/utils';
import {
  gameState,
  getRentStrategies,
  initialiseGame,
  isPaused,
  pauseGame,
  resumeGame,
  sellProperty,
  tickDay
} from './game';

type TestProperty = Parameters<typeof getRentStrategies>[0];

function createProperty(overrides: Partial<TestProperty> = {}): TestProperty {
  const base = {
    id: 'test-property',
    name: 'Test Property',
    description: 'A property used for rent strategy tests.',
    propertyType: 'apartment',
    bedrooms: 2,
    bathrooms: 1,
    features: [],
    locationDescriptor: 'Central location',
    demandScore: 8,
    location: {
      proximity: 0.5,
      schoolRating: 6,
      crimeScore: 4
    },
    baseValue: 320_000,
    cost: 300_000,
    maintenancePercent: 70,
    monthlyRentEstimate: 1_800,
    rentPlanId: '',
    tenant: null,
    mortgage: null,
    autoRelist: true,
    rentalMarketingPausedForMaintenance: false,
    maintenanceWork: null,
    marketAge: 0,
    introducedOnDay: 1,
    vacancyMonths: 0
  } as TestProperty;

  return { ...base, ...overrides };
}

describe('market listing lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    initialiseGame();
  });

  it('starts with fewer listings than the maximum size', () => {
    const state = get(gameState);
    expect(state.market.length).toBeLessThan(MARKET_CONFIG.maxSize);
  });

  it('adds new listings after the generation interval when space is available', () => {
    const state = get(gameState);
    const trimmedMarket = state.market.slice(0, 2).map((property) => ({ ...property, marketAge: 0 }));
    gameState.set({
      ...state,
      market: trimmedMarket,
      lastMarketGenerationDay: state.day
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const baseline = trimmedMarket.length;
    for (let day = 0; day < MARKET_CONFIG.generationInterval; day += 1) {
      tickDay();
    }

    const updated = get(gameState);
    expect(updated.market.length).toBeGreaterThan(baseline);
    expect(updated.lastMarketGenerationDay).toBe(updated.day);
  });

  it('retires listings that exceed the maximum market age', () => {
    const state = get(gameState);
    const [first] = state.market;
    const agedListing = { ...first, marketAge: MARKET_CONFIG.maxAge };
    gameState.set({
      ...state,
      market: [agedListing],
      lastMarketGenerationDay: state.day
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    tickDay();

    const updated = get(gameState);
    expect(updated.market).toHaveLength(0);
  });
});

describe('getRentStrategies', () => {
  it('returns expanded lease and premium combinations with rent derived from base rate', () => {
    const property = createProperty();
    const baseRate = 0.03;

    const plans = getRentStrategies(property, baseRate);

    expect(plans).toHaveLength(50);

    const leaseMonths = Array.from(new Set(plans.map((plan) => plan.leaseMonths))).sort((a, b) => a - b);
    expect(leaseMonths).toEqual([6, 12, 18, 24, 36]);

    const premiums = Array.from(new Set(plans.map((plan) => plan.rateOffset))).sort((a, b) => a - b);
    expect(premiums).toEqual([0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1]);

    const shortPlan = plans.find(
      (plan) => plan.leaseMonths === 6 && Math.abs(plan.rateOffset - 0.01) < 1e-6
    );
    expect(shortPlan?.monthlyRent).toBeCloseTo(1_000, 2);

    const midPlan = plans.find(
      (plan) => plan.leaseMonths === 12 && Math.abs(plan.rateOffset - 0.05) < 1e-6
    );
    expect(midPlan?.monthlyRent).toBeCloseTo(2_000, 2);

    const longPlan = plans.find(
      (plan) => plan.leaseMonths === 36 && Math.abs(plan.rateOffset - 0.1) < 1e-6
    );
    expect(longPlan?.monthlyRent).toBeCloseTo(3_250, 2);
  });

  it('reacts to lease length and premium when calculating tenant probability', () => {
    const property = createProperty({ demandScore: 8 });
    const baseRate = 0.03;

    const plans = getRentStrategies(property, baseRate);

    const shortLowPremium = plans.find(
      (plan) => plan.leaseMonths === 6 && Math.abs(plan.rateOffset - 0.01) < 1e-6
    );
    const balancedPlan = plans.find(
      (plan) => plan.leaseMonths === 24 && Math.abs(plan.rateOffset - 0.05) < 1e-6
    );
    const longHighPremium = plans.find(
      (plan) => plan.leaseMonths === 36 && Math.abs(plan.rateOffset - 0.1) < 1e-6
    );

    expect(shortLowPremium?.probability).toBeCloseTo(0.544, 3);
    expect(balancedPlan?.probability).toBeCloseTo(0.529, 3);
    expect(longHighPremium?.probability).toBeCloseTo(0.272, 3);

    expect(shortLowPremium!.probability).toBeGreaterThan(longHighPremium!.probability);
  });
});

describe('mortgage processing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    initialiseGame();
  });

  it('amortises repayment mortgage balances each month', () => {
    const initialState = get(gameState);
    const mortgage = {
      depositRatio: 0.2,
      deposit: 50_000,
      principal: 200_000,
      fixedPeriodYears: 2,
      fixedPeriodMonths: 24,
      interestOnly: false,
      annualInterestRate: 0.04,
      reversionRate: 0.05,
      baseRate: initialState.centralBankRate,
      variableRateMargin: 0.02,
      variableRateActive: false,
      monthlyPayment: 1_200,
      monthlyInterestRate: 0.04 / 12,
      remainingTermMonths: 360,
      termMonths: 360,
      remainingBalance: 200_000
    } as const;

    const property = createProperty({
      id: 'amortise-test',
      name: 'Amortise Test',
      autoRelist: false,
      tenant: null,
      mortgage: { ...mortgage }
    });

    gameState.set({
      ...initialState,
      balance: 10_000,
      portfolio: [property],
      lastRentCollectionDay: initialState.day - 30
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    tickDay();

    const updated = get(gameState);
    const updatedMortgage = updated.portfolio[0]?.mortgage;
    expect(updatedMortgage?.remainingBalance).toBeLessThan(mortgage.remainingBalance);
    expect(updatedMortgage?.remainingTermMonths).toBe(mortgage.remainingTermMonths - 1);
  });

  it('activates variable rates once the fixed period is completed', () => {
    const initialState = get(gameState);
    const mortgage = {
      depositRatio: 0.25,
      deposit: 60_000,
      principal: 180_000,
      fixedPeriodYears: 1,
      fixedPeriodMonths: 1,
      interestOnly: false,
      annualInterestRate: 0.035,
      reversionRate: 0.055,
      baseRate: initialState.centralBankRate,
      variableRateMargin: 0.02,
      variableRateActive: false,
      monthlyPayment: 1_100,
      monthlyInterestRate: 0.035 / 12,
      remainingTermMonths: 240,
      termMonths: 240,
      remainingBalance: 180_000
    } as const;

    const property = createProperty({
      id: 'variable-test',
      name: 'Variable Test',
      autoRelist: false,
      tenant: null,
      mortgage: { ...mortgage }
    });

    gameState.set({
      ...initialState,
      balance: 20_000,
      portfolio: [property],
      lastRentCollectionDay: initialState.day - 30
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    tickDay();

    const updated = get(gameState);
    const updatedMortgage = updated.portfolio[0]?.mortgage;
    expect(updatedMortgage?.variableRateActive).toBe(true);
    const expectedRate = updated.centralBankRate + mortgage.variableRateMargin;
    expect(updatedMortgage?.annualInterestRate).toBeCloseTo(expectedRate, 6);
    const activationLogged = updated.history.some((entry) =>
      entry.message.includes('Variable Test mortgage reverted to variable rate')
    );
    expect(activationLogged).toBe(true);
  });

  it('forces a sale when an interest-only balloon cannot be paid', () => {
    const initialState = get(gameState);
    const mortgage = {
      depositRatio: 0.1,
      deposit: 30_000,
      principal: 270_000,
      fixedPeriodYears: 1,
      fixedPeriodMonths: 12,
      interestOnly: true,
      annualInterestRate: 0.04,
      reversionRate: 0.05,
      baseRate: initialState.centralBankRate,
      variableRateMargin: 0.01,
      variableRateActive: true,
      monthlyPayment: 900,
      monthlyInterestRate: 0.04 / 12,
      remainingTermMonths: 0,
      termMonths: 240,
      remainingBalance: 50_000
    } as const;

    const property = createProperty({
      id: 'balloon-test',
      name: 'Balloon Test',
      autoRelist: false,
      tenant: null,
      maintenancePercent: 80,
      baseValue: 200_000,
      mortgage: { ...mortgage }
    });

    gameState.set({
      ...initialState,
      balance: 5_000,
      portfolio: [property],
      lastRentCollectionDay: initialState.day - 30
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    tickDay();

    const updated = get(gameState);
    expect(updated.portfolio).toHaveLength(0);
    const lastHistory = updated.history[updated.history.length - 1]?.message ?? '';
    expect(lastHistory).toContain('Forced sale of Balloon Test');
    expect(updated.balance).toBeGreaterThan(initialState.balance);
  });
});

describe('modal-driven pause management', () => {
  beforeEach(() => {
    initialiseGame();
  });

  it('pauses when a modal opens and resumes after the last modal closes', () => {
    expect(get(isPaused)).toBe(false);

    pauseGame();
    expect(get(isPaused)).toBe(true);

    resumeGame();
    expect(get(isPaused)).toBe(false);
  });

  it('keeps the game paused while any modal remains open', () => {
    pauseGame();
    pauseGame();

    expect(get(isPaused)).toBe(true);

    resumeGame();
    expect(get(isPaused)).toBe(true);

    resumeGame();
    expect(get(isPaused)).toBe(false);
  });

  it('restores the previous pause state when all modals close', () => {
    const state = get(gameState);
    gameState.set({ ...state, isPaused: true });

    pauseGame();
    pauseGame();

    expect(get(isPaused)).toBe(true);

    resumeGame();
    expect(get(isPaused)).toBe(true);

    resumeGame();
    expect(get(isPaused)).toBe(true);
  });
});

describe('sellProperty', () => {
  const maintenanceThreshold = MAINTENANCE_CONFIG.criticalThreshold ?? 25;

  beforeEach(() => {
    vi.restoreAllMocks();
    initialiseGame();
  });

  function seedPortfolio(property: TestProperty, balance: number) {
    const baseState = get(gameState);
    gameState.set({
      ...baseState,
      balance,
      portfolio: [property],
      market: [],
      history: [],
      management: { ...baseState.management, open: false, propertyId: null },
      finance: { ...baseState.finance, open: false, propertyId: null }
    });
  }

  it('prevents sale when maintenance is below the threshold and records the attempt', () => {
    const property = createProperty({
      id: 'low-maintenance',
      name: 'Low Maintenance',
      maintenancePercent: Math.max(maintenanceThreshold - 5, 0),
      maintenanceWork: null
    });

    seedPortfolio(property, 50_000);

    sellProperty('low-maintenance');

    const updated = get(gameState);
    expect(updated.portfolio).toHaveLength(1);
    const lastMessage = updated.history.at(-1)?.message ?? '';
    expect(lastMessage).toContain('Sale attempt blocked');
    expect(lastMessage.toLowerCase()).toContain('maintenance');
  });

  it('prevents sale when maintenance work is active and logs the restriction', () => {
    const property = createProperty({
      id: 'active-maintenance',
      name: 'Active Maintenance',
      maintenancePercent: maintenanceThreshold + 10,
      maintenanceWork: {
        monthsRemaining: 1,
        cost: 5_000,
        scheduledOnDay: 0,
        startDelayMonths: 0
      }
    });

    seedPortfolio(property, 60_000);

    sellProperty('active-maintenance');

    const updated = get(gameState);
    expect(updated.portfolio).toHaveLength(1);
    const lastMessage = updated.history.at(-1)?.message ?? '';
    expect(lastMessage).toContain('Sale attempt blocked');
    expect(lastMessage).toContain('Maintenance work must be complete');
  });

  it('credits net proceeds when a property sale succeeds', () => {
    const mortgage = {
      depositRatio: 0.2,
      deposit: 40_000,
      principal: 160_000,
      fixedPeriodYears: 2,
      fixedPeriodMonths: 24,
      interestOnly: false,
      annualInterestRate: 0.04,
      reversionRate: 0.05,
      baseRate: 0.03,
      variableRateMargin: 0.02,
      variableRateActive: false,
      monthlyPayment: 900,
      monthlyInterestRate: 0.04 / 12,
      remainingTermMonths: 300,
      termMonths: 360,
      remainingBalance: 50_000
    } as const;

    const property = createProperty({
      id: 'sale-success',
      name: 'Sale Success',
      maintenancePercent: Math.max(maintenanceThreshold + 55, 80),
      baseValue: 200_000,
      cost: 200_000,
      mortgage: { ...mortgage },
      maintenanceWork: null
    });

    const startingBalance = 10_000;
    seedPortfolio(property, startingBalance);

    sellProperty('sale-success');

    const updated = get(gameState);
    expect(updated.portfolio).toHaveLength(0);
    const salePrice = Math.round((property.baseValue * property.maintenancePercent) / 100);
    const expectedNet = salePrice - mortgage.remainingBalance;
    const expectedBalance = startingBalance + expectedNet;
    expect(updated.balance).toBe(expectedBalance);
    const lastMessage = updated.history.at(-1)?.message ?? '';
    expect(lastMessage).toContain('Sold Sale Success');
    expect(lastMessage).toContain(`netted ${formatCurrency(expectedNet)}`);
  });

  it('repays any outstanding mortgage balance during the sale', () => {
    const mortgage = {
      depositRatio: 0.25,
      deposit: 30_000,
      principal: 120_000,
      fixedPeriodYears: 1,
      fixedPeriodMonths: 12,
      interestOnly: false,
      annualInterestRate: 0.035,
      reversionRate: 0.045,
      baseRate: 0.03,
      variableRateMargin: 0.015,
      variableRateActive: false,
      monthlyPayment: 750,
      monthlyInterestRate: 0.035 / 12,
      remainingTermMonths: 200,
      termMonths: 240,
      remainingBalance: 30_000
    } as const;

    const property = createProperty({
      id: 'mortgage-clearance',
      name: 'Mortgage Clearance',
      maintenancePercent: maintenanceThreshold + 20,
      baseValue: 150_000,
      cost: 150_000,
      mortgage: { ...mortgage }
    });

    seedPortfolio(property, 5_000);

    sellProperty('mortgage-clearance');

    const updated = get(gameState);
    expect(updated.portfolio).toHaveLength(0);
    const lastMessage = updated.history.at(-1)?.message ?? '';
    expect(lastMessage).toContain('Repaid $30,000 outstanding');
  });
});
