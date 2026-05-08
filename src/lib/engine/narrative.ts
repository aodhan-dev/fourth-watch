// Presentation helpers for encounter narration. Lives next to the engine
// rather than inside it so wording/i18n changes don't pull on encounter.ts.

import type { Monster, ModifierRule, EncounterAttitude } from './types';

const IRREGULAR_PLURALS: Record<string, string> = {
  drow: 'drow',
  sheep: 'sheep',
  fish: 'fish',
  deer: 'deer'
};

export function pluralise(name: string): string {
  const lower = name.toLowerCase();
  if (IRREGULAR_PLURALS[lower]) return IRREGULAR_PLURALS[lower];
  // "Swarm of X" stays singular ("4 swarm of bats" reads oddly but cleaner than appending 's' inside the phrase).
  if (lower.startsWith('swarm of ')) return lower;
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh'))
    return `${lower}es`;
  return `${lower}s`;
}

export function indefiniteArticle(name: string): string {
  return /^[aeiou]/i.test(name) ? 'An' : 'A';
}

function attitudeVerbPhrase(count: number, attitude: EncounterAttitude): string {
  const sing = count === 1;
  switch (attitude) {
    case 'Hostile':
      return sing ? 'appears' : 'appear';
    case 'Indifferent':
      return sing ? 'passes by, paying you no mind' : 'pass by, paying you no mind';
    case 'Friendly':
      return sing ? 'draws near with curiosity' : 'draw near with curiosity';
  }
}

export function buildNarrative(
  creature: Monster,
  count: number,
  rules: ModifierRule[],
  attitude: EncounterAttitude = 'Hostile'
): string {
  const fragments = rules.map((r) => r.narrativeFragment).filter((f): f is string => Boolean(f));
  const subj =
    count === 1
      ? `${indefiniteArticle(creature.name)} ${creature.name.toLowerCase()}`
      : `${count} ${pluralise(creature.name)}`;
  const tail = fragments.length > 0 ? ` ${fragments.join(', ')}.` : '.';
  const verb = attitudeVerbPhrase(count, attitude);
  return `${subj} ${verb}${tail}`;
}
