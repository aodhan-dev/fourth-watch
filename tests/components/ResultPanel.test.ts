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
    expect(screen.getByRole('button', { name: /roll again/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /weather/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /encounter/i })).toBeTruthy();
  });

  it('ResultPanel has no aria-live region (status lives in page)', () => {
    const { container } = render(ResultPanel, {
      result: null,
      onRerollAll: vi.fn(),
      onRerollWeather: vi.fn(),
      onRerollEncounter: vi.fn()
    });
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('seed code is described by its label', () => {
    render(ResultPanel, {
      result: stubResult,
      onRerollAll: vi.fn(),
      onRerollWeather: vi.fn(),
      onRerollEncounter: vi.fn()
    });
    const code = document.querySelector('code');
    expect(code?.getAttribute('aria-describedby')).toBe('seed-label');
  });

  it('Copy button shows idle label initially', () => {
    render(ResultPanel, {
      result: stubResult,
      onRerollAll: vi.fn(),
      onRerollWeather: vi.fn(),
      onRerollEncounter: vi.fn()
    });
    const copyBtn = document.querySelector('.copy-btn') as HTMLButtonElement;
    expect(copyBtn?.textContent?.trim()).toBe('Copy');
  });
});
