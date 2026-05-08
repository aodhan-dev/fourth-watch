// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EncounterBlock from '../../src/lib/components/EncounterBlock.svelte';
import type { Encounter } from '../../src/lib/engine/types';

const stubEncounter: Encounter = {
  creature: {
    slug: 'wolf',
    name: 'Wolf',
    cr: 0.25,
    type: 'beast',
    size: 'Medium',
    environments: ['Forest'],
    hp: 11,
    ac: 13,
    speed: '40ft',
    category: 'Predator'
  },
  count: 2,
  narrative: '2 wolves appear.',
  contributingModifiers: []
};

describe('EncounterBlock', () => {
  it('renders a message when encounter is null', () => {
    render(EncounterBlock, { encounter: null, message: 'No encounter tonight.' });
    expect(screen.getByText(/no encounter tonight/i)).toBeTruthy();
  });

  it('renders the encounter section when encounter is provided', () => {
    render(EncounterBlock, { encounter: stubEncounter, message: null });
    expect(screen.getByText('Encounter')).toBeTruthy();
  });

  it('renders the narrative text', () => {
    render(EncounterBlock, { encounter: stubEncounter, message: null });
    expect(screen.getByText(/wolves appear/i)).toBeTruthy();
  });

  it('shows null message slot when no message', () => {
    const { container } = render(EncounterBlock, { encounter: null, message: null });
    expect(container).toBeTruthy();
  });

  it('expand button has a rotating chevron indicator', () => {
    const { container } = render(EncounterBlock, { encounter: stubEncounter, message: null });
    const btn = container.querySelector('button.expand') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.querySelector('.chevron')).toBeTruthy();
  });
});
