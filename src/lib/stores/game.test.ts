import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

import { MARKET_CONFIG } from '$lib/config';
import { gameState, initialiseGame, tickDay } from './game';

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
