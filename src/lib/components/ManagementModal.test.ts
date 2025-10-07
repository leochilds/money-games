import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ManagementModal from './ManagementModal.svelte';

const defaultProps = {
  open: false,
  activeSection: 'overview',
  subtitle: 'Test subtitle',
  summaryHtml: '<p>Summary</p>',
  overviewHtml: '<p>Overview</p>',
  leasingHtml: '<p>Leasing</p>',
  financingHtml: '<p>Financing</p>',
  transactionsHtml: '<p>Transactions</p>',
  maintenanceHtml: '<p>Maintenance</p>',
  propertyId: 'prop-1',
  isOwned: true,
  leasingControls: {
    plans: [
      {
        id: 'plan-1',
        label: '12 months +5%',
        leaseMonths: 12,
        rateOffset: 0.05,
        monthlyRent: 2200,
        probability: 0.5
      }
    ],
    leaseMonthsOptions: [6, 12, 18],
    rentPremiumOptions: [
      { value: 0.03, label: '+3%' },
      { value: 0.05, label: '+5%' }
    ],
    selectedPlanId: 'plan-1',
    selectedLeaseMonths: 12,
    selectedRateOffset: 0.05,
    autoRelist: false,
    marketingPaused: false,
    hasTenant: false
  },
  maintenanceState: {
    maintenancePercent: 60,
    projectedCost: 5_000,
    projectedPercent: 85,
    tenantMonthsRemaining: 0,
    leaseCountdownLabel: null,
    work: null,
    workDelayMonths: 0,
    workIsActive: false,
    maintenanceThreshold: 25,
    canSchedule: true,
    reasons: {
      atMaxMaintenance: false,
      alreadyScheduled: false,
      insufficientFunds: false
    }
  },
  saleState: {
    salePrice: 320_000,
    outstandingBalance: 150_000,
    netProceeds: 170_000,
    maintenancePercent: 60,
    maintenanceThreshold: 25,
    canSell: true,
    restrictions: []
  }
};

describe('ManagementModal', () => {
  beforeEach(() => {
    const instance = { show: vi.fn(), hide: vi.fn(), dispose: vi.fn() };
    const modalApi = { getOrCreateInstance: vi.fn(() => instance) };
    Object.defineProperty(window, 'bootstrap', {
      configurable: true,
      value: { Modal: modalApi }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'bootstrap');
  });

  it('emits section change events when navigation buttons are clicked', async () => {
    const events: string[] = [];
    render(ManagementModal, {
      props: defaultProps,
      events: {
        sectionchange: (event) => {
          events.push(event.detail as string);
        }
      }
    });

    const maintenanceButton = screen.getByRole('button', { name: 'Maintenance' });
    await fireEvent.click(maintenanceButton);

    expect(events).toContain('maintenance');
  });

  it('dispatches leasing preference events for sliders and toggles', async () => {
    const leaseChanges: Array<{ propertyId: string; leaseMonths: number }> = [];
    const rentChanges: Array<{ propertyId: string; rateOffset: number }> = [];
    const autoRelistChanges: Array<{ propertyId: string; enabled: boolean }> = [];
    const marketingChanges: Array<{ propertyId: string; paused: boolean }> = [];

    render(ManagementModal, {
      props: defaultProps,
      events: {
        leasechange: (event) => leaseChanges.push(event.detail),
        rentchange: (event) => rentChanges.push(event.detail),
        autorelisttoggle: (event) => autoRelistChanges.push(event.detail),
        marketingtoggle: (event) => marketingChanges.push(event.detail)
      }
    });

    const leaseSlider = screen.getByLabelText('Lease length') as HTMLInputElement;
    const rentSlider = screen.getByLabelText('Rent premium') as HTMLInputElement;
    const autoRelistToggle = screen.getByLabelText('Auto-relist vacant property') as HTMLInputElement;
    const marketingToggle = screen.getByLabelText('Pause marketing for maintenance') as HTMLInputElement;

    await fireEvent.change(leaseSlider, { target: { value: '1' } });
    await fireEvent.change(rentSlider, { target: { value: '0' } });
    await fireEvent.click(autoRelistToggle);
    await fireEvent.click(marketingToggle);

    expect(leaseChanges.at(-1)).toEqual({ propertyId: 'prop-1', leaseMonths: 12 });
    expect(rentChanges.at(-1)).toEqual({ propertyId: 'prop-1', rateOffset: 0.03 });
    expect(autoRelistChanges.at(-1)).toEqual({ propertyId: 'prop-1', enabled: true });
    expect(marketingChanges.at(-1)).toEqual({ propertyId: 'prop-1', paused: true });
  });

  it('only allows scheduling maintenance when permitted', async () => {
    const maintenanceSpy = vi.fn();
    render(ManagementModal, {
      props: defaultProps,
      events: {
        maintenanceschedule: maintenanceSpy
      }
    });

    const button = screen.getByRole('button', { name: 'Schedule maintenance' });
    await fireEvent.click(button);

    expect(maintenanceSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: { propertyId: 'prop-1' } }));
  });

  it('emits sell events when the sale action is available', async () => {
    const sellSpy = vi.fn();
    render(ManagementModal, {
      props: { ...defaultProps, activeSection: 'transactions' },
      events: {
        sell: sellSpy
      }
    });

    const sellButton = screen.getByRole('button', { name: 'Sell property' });
    await fireEvent.click(sellButton);

    expect(sellSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: { propertyId: 'prop-1' } }));
  });
});
