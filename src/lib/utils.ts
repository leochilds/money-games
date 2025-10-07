import { propertyTypeLabels } from '$lib/config';

export function getRandomInt(min: number, max: number): number {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

export function getRandomNumber(min: number, max: number, precision = 2): number {
  const value = Math.random() * (max - min) + min;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function pickRandom<T>(items: readonly T[]): T {
  return items[getRandomInt(0, items.length - 1)];
}

export function selectFeatureSubset(featuresPool: readonly string[]): string[] {
  if (!Array.isArray(featuresPool) || featuresPool.length === 0) {
    return [];
  }

  const maxSelectable = Math.min(featuresPool.length, 4);
  const minSelectable = Math.min(2, maxSelectable);
  const subsetSize = getRandomInt(minSelectable, maxSelectable);
  const poolCopy = [...featuresPool];
  const selected: string[] = [];

  while (selected.length < subsetSize && poolCopy.length > 0) {
    const index = getRandomInt(0, poolCopy.length - 1);
    selected.push(poolCopy.splice(index, 1)[0]);
  }

  return selected;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(Math.round(amount));
}

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function roundRate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function formatPropertyType(type: string): string {
  return propertyTypeLabels[type as keyof typeof propertyTypeLabels] ?? type;
}

export function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return `${Math.round(value * 100)}%`;
}

export function formatInterestRate(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function formatLeaseCountdown(months: number): string {
  if (!Number.isFinite(months) || months <= 0) {
    return '0 months';
  }
  const rounded = Math.round(months);
  const years = Math.floor(rounded / 12);
  const remainingMonths = rounded % 12;
  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} year${years === 1 ? '' : 's'}`);
  }
  if (remainingMonths > 0 || parts.length === 0) {
    parts.push(`${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`);
  }
  return parts.join(' ');
}
