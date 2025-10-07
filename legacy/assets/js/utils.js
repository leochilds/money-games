import { propertyTypeLabels } from "./config.js";

export function getRandomInt(min, max) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

export function getRandomNumber(min, max, precision = 2) {
  const value = Math.random() * (max - min) + min;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function pickRandom(items) {
  return items[getRandomInt(0, items.length - 1)];
}

export function selectFeatureSubset(featuresPool) {
  if (!Array.isArray(featuresPool) || featuresPool.length === 0) {
    return [];
  }
  const maxSelectable = Math.min(featuresPool.length, 4);
  const minSelectable = Math.min(2, maxSelectable);
  const subsetSize = getRandomInt(minSelectable, maxSelectable);
  const poolCopy = [...featuresPool];
  const selected = [];
  while (selected.length < subsetSize && poolCopy.length > 0) {
    const index = getRandomInt(0, poolCopy.length - 1);
    selected.push(poolCopy.splice(index, 1)[0]);
  }
  return selected;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

export function roundRate(value) {
  return Math.round(value * 10000) / 10000;
}

export function formatPropertyType(type) {
  return propertyTypeLabels[type] ?? type;
}

export function formatPercentage(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${Math.round(value * 100)}%`;
}

export function formatInterestRate(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${(value * 100).toFixed(2)}%`;
}
