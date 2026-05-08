// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ResultPanel from '../../src/lib/components/ResultPanel.svelte';
import type { RollResult } from '../../src/lib/engine/types';

const stubResult: RollResult = {
  seed: 42,
  weather: {
    temp: 'Temperate',
    precip: 'Clear',
    wind: 'None',
    narrative: 'Mild, with clear skies and still air.',
    effects: []
  },
  encounter: null,
  encounterMessage: 'No encounter.'
};

describe('ResultPanel', () => {
  it('shows placeholder when result is null', () => {
    render(ResultPanel, {
      result: null,
      onRerollAll: vi.fn(),
      onRerollWeather: vi.fn(),
      onRerollEncounter: vi.fn()
    });
    expect(screen.getByText(/pick the scene/i)).toBeTruthy();
  });

  it('renders weather narrative when result is provided', () => {
    render(ResultPanel, {
      result: stubResult,
      onRerollAll: vi.fn(),
      onRerollWeather: vi.fn(),
      onRerollEncounter: vi.fn()
    });
    expect(screen.getByText(/mild/i)).toBeTruthy();
  });

  it('shows the seed value', () => {
    render(ResultPanel, {
      result: stubResult,
      onRerollAll: vi.fn(),
      onRerollWeather: vi.fn(),
      onRerollEncounter: vi.fn()
    });
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('shows reroll buttons when result is present', () => {
    render(ResultPanel, {
      result: stubResult,
      onRerollAll: vi.fn(),
      onRerollWeather: vi.fn(),
      onRerollEncounter: vi.fn()
    });
    expect(screen.getByText('↻ Roll again')).toBeTruthy();
    expect(screen.getByText('↻ Weather')).toBeTruthy();
    expect(screen.getByText('↻ Encounter')).toBeTruthy();
  });
});
