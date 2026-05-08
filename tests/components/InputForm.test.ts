// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import InputForm from '../../src/lib/components/InputForm.svelte';

const defaultValue = {
  climate: '' as const,
  environment: '' as const,
  season: '' as const,
  time: '' as const,
  region: '' as const,
  partyLevel: 3,
  partySize: 4,
  mode: 'Travelling' as const,
  campfire: false,
  noise: false
};

describe('InputForm', () => {
  it('renders without crashing', () => {
    render(InputForm, { value: defaultValue, onRoll: vi.fn(), canRoll: false });
    expect(screen.getByText('Party')).toBeTruthy();
    expect(screen.getByText('Setting')).toBeTruthy();
    expect(screen.getByText('Activity')).toBeTruthy();
  });

  it('Roll button is disabled when canRoll is false', () => {
    render(InputForm, { value: defaultValue, onRoll: vi.fn(), canRoll: false });
    const btn = screen.getByRole('button', { name: /roll/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Roll button is enabled when canRoll is true', () => {
    render(InputForm, { value: defaultValue, onRoll: vi.fn(), canRoll: true });
    const btn = screen.getByRole('button', { name: /roll/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('renders climate select with placeholder option', () => {
    render(InputForm, { value: defaultValue, onRoll: vi.fn(), canRoll: false });
    expect(screen.getByRole('combobox', { name: /climate/i })).toBeTruthy();
  });
});
