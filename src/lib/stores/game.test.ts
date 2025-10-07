import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

import { MARKET_CONFIG } from '$lib/config';
import { gameState, getRentStrategies, initialiseGame, tickDay } from './game';

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
