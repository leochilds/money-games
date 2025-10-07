import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import PropertyPortfolio from './PropertyPortfolio.svelte';

const baseProperty = {
  id: 'prop-1',
  name: 'Test Property',
  description: 'A great investment.',
  summaryHtml: '<strong>2</strong> bed',
  featureTags: ['Balcony'],
  locationDetailsHtml: '<span>City centre</span>',
  demandHtml: '<span>High demand</span>',
  maintenanceLabel: '80% condition',
  maintenancePercent: 80,
  costHtml: '<span>$300,000</span>',
  rentHtml: '<span>$2,000/mo</span>',
  statusChips: [{ label: 'Vacant', variant: 'bg-warning' }],
  owned: false,
  disablePurchase: false,
  manageLabel: 'Inspect',
  showSell: true,
  sellLabel: 'Sell',
  sellDisabled: false,
  sellDisabledReason: ''
};

describe('PropertyPortfolio', () => {
  it('renders an empty state when no properties are provided', () => {
    render(PropertyPortfolio, { props: { properties: [], showEmptyStateMessage: true } });

    expect(
      screen.getByText('Properties will appear here once the market data is loaded.')
    ).toBeInTheDocument();
  });

  it('emits events for manage, purchase, and sell actions', async () => {
    const manageSpy = vi.fn();
    const purchaseSpy = vi.fn();
    const sellSpy = vi.fn();

    render(PropertyPortfolio, {
      props: { properties: [baseProperty] },
      events: {
        manage: (event) => manageSpy(event),
        purchase: (event) => purchaseSpy(event),
        sell: (event) => sellSpy(event)
      }
    });

    await fireEvent.click(screen.getByLabelText('Manage Test Property'));
    await fireEvent.click(screen.getByRole('button', { name: 'Purchase' }));
    await fireEvent.click(screen.getByLabelText('Sell Test Property'));

    expect(manageSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: 'prop-1' }));
    expect(purchaseSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: 'prop-1' }));
    expect(sellSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: 'prop-1' }));
  });

  it('disables purchase and sell buttons based on property flags', () => {
    render(PropertyPortfolio, {
      props: {
        properties: [
          {
            ...baseProperty,
            id: 'prop-2',
            disablePurchase: true,
            sellDisabled: true,
            sellDisabledReason: 'Maintenance too low'
          }
        ]
      }
    });

    const purchaseButton = screen.getByRole('button', { name: 'Purchase' });
    const sellButton = screen.getByLabelText('Sell Test Property');

    expect(purchaseButton).toBeDisabled();
    expect(sellButton).toBeDisabled();
    expect(sellButton).toHaveAttribute('title', 'Maintenance too low');
  });
});
