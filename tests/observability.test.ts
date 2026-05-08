import { describe, it, expect, vi } from 'vitest';
import { logRoll, makeDigest } from '../src/lib/observability';
import type { Inputs, RollResult } from '../src/lib/engine/types';

const stubInputs: Inputs = {
  climate: 'Temperate',
  environment: 'Forest',
  season: 'Spring',
  time: 'Dawn',
  region: 'Frontier',
  partyLevel: 3,
  partySize: 4,
  mode: 'Travelling',
  campfire: false,
  noise: false,
  mood: 'mixed'
};

const stubResult: RollResult = {
  seed: 42,
  weather: {
    temp: 'Temperate',
    precip: 'Clear',
    wind: 'None',
    narrative: 'Mild and clear.',
    effects: []
  },
  encounter: null,
  encounterMessage: 'No encounter.'
};

describe('makeDigest', () => {
  it('includes weather fields and no-encounter marker when encounter is null', () => {
    const d = makeDigest(stubResult);
    expect(d).toContain('Temperate');
    expect(d).toContain('Clear');
    expect(d).toContain('None');
    expect(d).toContain('no-encounter');
  });

  it('includes creature name when encounter is present', () => {
    const withEnc: RollResult = {
      ...stubResult,
      encounter: {
        creature: {
          slug: 'goblin',
          name: 'Goblin',
          cr: 0.25,
          ac: 15,
          hp: 7,
          speed: '30 ft.',
          size: 'Small',
          type: 'humanoid',
          environments: ['Forest'],
          category: 'Other'
        },
        count: 1,
        attitude: 'Hostile',
        narrative: 'A goblin.',
        contributingModifiers: []
      }
    };
    expect(makeDigest(withEnc)).toContain('Goblin');
  });
});

describe('logRoll', () => {
  it('calls the logger once with [fw] roll tag and structured payload', () => {
    const logger = vi.fn();
    logRoll(42, stubInputs, stubResult, logger);

    expect(logger).toHaveBeenCalledOnce();
    const [tag, payload] = logger.mock.calls[0] as [string, Record<string, unknown>];
    expect(tag).toBe('[fw] roll');
    expect(payload.seed).toBe(42);
    expect(payload.climate).toBe('Temperate');
    expect(payload.partyLevel).toBe(3);
    expect(payload.partySize).toBe(4);
    expect(typeof payload.digest).toBe('string');
    expect(String(payload.digest)).toContain('Temperate');
    expect(String(payload.digest)).toContain('no-encounter');
  });

  it('digest is recoverable: seed + digest identify the roll uniquely', () => {
    const logger = vi.fn();
    logRoll(99, stubInputs, stubResult, logger);
    const [, payload] = logger.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.seed).toBe(99);
    expect(String(payload.digest)).toMatch(/^[A-Za-z]+:[A-Za-z]+:[A-Za-z]+:no-encounter$/);
  });
});
