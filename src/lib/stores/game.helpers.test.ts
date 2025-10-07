import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { MAINTENANCE_CONFIG, type PropertyDefinition } from '$lib/config';
import { createEmptyMaintenanceState, __testing } from './game';

const {
  clampMaintenancePercent,
  calculateMaintenanceAdjustedValue,
  calculateMonthlyRentEstimate,
  calculatePropertyValue,
  getMaintenanceThreshold,
  hasActiveMaintenanceWork
} = __testing;

describe('maintenance helpers', () => {
  it('creates an empty maintenance state with default values', () => {
    const state = createEmptyMaintenanceState();

    expect(state).toEqual({
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
    });
  });

  it('clamps maintenance percentages into a valid range', () => {
    expect(clampMaintenancePercent(150)).toBe(100);
    expect(clampMaintenancePercent(-10)).toBe(0);
    expect(clampMaintenancePercent(42.678)).toBeCloseTo(42.7);
    expect(clampMaintenancePercent(undefined)).toBe(0);
  });

  it('calculates an adjusted value based on maintenance percent', () => {
    expect(calculateMaintenanceAdjustedValue(250_000, 80)).toBe(200_000);
    expect(calculateMaintenanceAdjustedValue(100_000, -20)).toBe(0);
  });

  it('estimates monthly rent from property cost and demand', () => {
    const estimate = calculateMonthlyRentEstimate(350_000, 6);
    const expected = Math.round(350_000 * 0.0065 + (6 - 5) * 45);
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBe(expected);
  });

  describe('maintenance thresholds', () => {
    let originalThreshold: number;

    beforeEach(() => {
      originalThreshold = MAINTENANCE_CONFIG.criticalThreshold;
    });

    afterEach(() => {
      MAINTENANCE_CONFIG.criticalThreshold = originalThreshold;
    });

    it('returns the configured threshold when valid', () => {
      MAINTENANCE_CONFIG.criticalThreshold = 30;
      expect(getMaintenanceThreshold()).toBe(30);
    });

    it('falls back to a sensible default when configuration is invalid', () => {
      MAINTENANCE_CONFIG.criticalThreshold = Number.NaN;
      expect(getMaintenanceThreshold()).toBe(25);
    });
  });

  it('detects active maintenance work while ignoring delayed jobs', () => {
    const property = {
      maintenanceWork: {
        monthsRemaining: 2,
        cost: 5000,
        scheduledOnDay: 1,
        startDelayMonths: 0
      }
    } as const;

    expect(hasActiveMaintenanceWork(property as any)).toBe(true);

    const delayed = {
      ...property,
      maintenanceWork: {
        ...property.maintenanceWork,
        startDelayMonths: 1
      }
    };

    expect(hasActiveMaintenanceWork(delayed as any)).toBe(false);
  });
});

describe('property valuation helpers', () => {
  it('combines property attributes and feature bonuses into a base value', () => {
    const property: PropertyDefinition = {
      id: 'test',
      name: 'Test Property',
      description: 'A test property',
      propertyType: 'townhouse',
      bedrooms: 3,
      bathrooms: 2,
      features: ['City View', 'Private Patio'],
      locationDescriptor: 'Prime area',
      demandScore: 7,
      location: {
        proximity: 0.8,
        schoolRating: 8,
        crimeScore: 3
      }
    };

    const value = calculatePropertyValue(property);
    expect(value).toBeGreaterThan(0);
    expect(value % 1).toBe(0);
  });
});
