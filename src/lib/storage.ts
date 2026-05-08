import type {
  Climate,
  Environment,
  Season,
  TimeOfDay,
  RegionType,
  TravelMode,
  EncounterMood
} from './engine/types';

export type FormState = {
  climate: Climate | '';
  environment: Environment | '';
  season: Season | '';
  time: TimeOfDay | '';
  region: RegionType | '';
  partyLevel: number;
  partySize: number;
  mode: TravelMode;
  campfire: boolean;
  noise: boolean;
  mood: EncounterMood;
};

const CLIMATES = new Set<string>([
  'Tropical',
  'Subtropical',
  'Arid',
  'Temperate',
  'Subarctic',
  'Arctic',
  ''
]);
const ENVIRONMENTS = new Set<string>([
  'Arctic',
  'Coastal',
  'Desert',
  'Forest',
  'Grassland',
  'Hills',
  'Mountains',
  'Swamp',
  'Underground',
  'Urban',
  'Wasteland',
  ''
]);
const SEASONS = new Set<string>(['Spring', 'Summer', 'Autumn', 'Winter', '']);
const TIMES = new Set<string>(['Dawn', 'Day', 'Dusk', 'Night', '']);
const REGIONS = new Set<string>(['Settled', 'Frontier', 'Wilderness', 'Hostile', '']);
const MODES = new Set<string>(['Travelling', 'AtCamp']);
const MOODS = new Set<string>(['hostile', 'mixed']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateFormState(raw: unknown): FormState | null {
  if (!isObject(raw)) return null;

  const {
    climate,
    environment,
    season,
    time,
    region,
    partyLevel,
    partySize,
    mode,
    campfire,
    noise,
    mood
  } = raw;

  if (!CLIMATES.has(climate as string)) return null;
  if (!ENVIRONMENTS.has(environment as string)) return null;
  if (!SEASONS.has(season as string)) return null;
  if (!TIMES.has(time as string)) return null;
  if (!REGIONS.has(region as string)) return null;
  if (
    typeof partyLevel !== 'number' ||
    !Number.isInteger(partyLevel) ||
    partyLevel < 1 ||
    partyLevel > 20
  )
    return null;
  if (
    typeof partySize !== 'number' ||
    !Number.isInteger(partySize) ||
    partySize < 1 ||
    partySize > 8
  )
    return null;
  if (!MODES.has(mode as string)) return null;
  if (typeof campfire !== 'boolean') return null;
  if (typeof noise !== 'boolean') return null;
  // Migrate v2 saved state silently: missing mood -> 'mixed' (the new default).
  // A present-but-invalid mood is rejected like any other tampered field.
  if (mood !== undefined && !MOODS.has(mood as string)) return null;
  const resolvedMood: EncounterMood = (mood as EncounterMood | undefined) ?? 'mixed';

  return {
    climate: climate as Climate | '',
    environment: environment as Environment | '',
    season: season as Season | '',
    time: time as TimeOfDay | '',
    region: region as RegionType | '',
    partyLevel,
    partySize,
    mode: mode as TravelMode,
    campfire,
    noise,
    mood: resolvedMood
  };
}
