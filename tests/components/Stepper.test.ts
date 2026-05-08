// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Stepper from '../../src/lib/components/Stepper.svelte';

describe('Stepper', () => {
  it('renders the initial value in an editable input', () => {
    render(Stepper, { value: 5, min: 1, max: 10, label: 'Level' });
    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('decrease button is disabled at min', () => {
    render(Stepper, { value: 1, min: 1, max: 10, label: 'Level' });
    const dec = screen.getByLabelText('Decrease Level') as HTMLButtonElement;
    expect(dec.disabled).toBe(true);
  });

  it('increase button is disabled at max', () => {
    render(Stepper, { value: 10, min: 1, max: 10, label: 'Level' });
    const inc = screen.getByLabelText('Increase Level') as HTMLButtonElement;
    expect(inc.disabled).toBe(true);
  });

  it('both buttons are enabled for a mid-range value', () => {
    render(Stepper, { value: 5, min: 1, max: 10, label: 'Size' });
    expect((screen.getByLabelText('Decrease Size') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Increase Size') as HTMLButtonElement).disabled).toBe(false);
  });

  it('exposes spinbutton role with aria-valuenow/min/max', () => {
    render(Stepper, { value: 5, min: 1, max: 10, label: 'Level' });
    const spinbutton = screen.getByRole('spinbutton', { name: /level/i });
    expect(spinbutton.getAttribute('aria-valuenow')).toBe('5');
    expect(spinbutton.getAttribute('aria-valuemin')).toBe('1');
    expect(spinbutton.getAttribute('aria-valuemax')).toBe('10');
  });

  it('editable number input has correct min/max attributes', () => {
    render(Stepper, { value: 3, min: 1, max: 8, label: 'Size' });
    const input = screen.getByDisplayValue('3') as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('8');
  });
});
