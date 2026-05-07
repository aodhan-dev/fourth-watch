export type Climate = 'Tropical' | 'Subtropical' | 'Arid' | 'Temperate' | 'Subarctic' | 'Arctic';
export type Environment =
  | 'Arctic'
  | 'Coastal'
  | 'Desert'
  | 'Forest'
  | 'Grassland'
  | 'Hills'
  | 'Mountains'
  | 'Swamp'
  | 'Underground'
  | 'Urban'
  | 'Wasteland';
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
export type TimeOfDay = 'Dawn' | 'Day' | 'Dusk' | 'Night';
export type RegionType = 'Settled' | 'Frontier' | 'Wilderness' | 'Hostile';
export type TravelMode = 'Travelling' | 'AtCamp';

export type Temperature = 'Freezing' | 'Cold' | 'Cool' | 'Temperate' | 'Warm' | 'Hot';
export type Precipitation = 'Clear' | 'Light' | 'Heavy';
export type Wind = 'None' | 'Low' | 'High';

export type MonsterCategory =
  | 'Predator'
  | 'Bandit'
  | 'Civilised'
  | 'Undead'
  | 'Fey'
  | 'Aberration'
  | 'Construct'
  | 'Other';

export interface Inputs {
  climate: Climate;
  environment: Environment;
  season: Season;
  time: TimeOfDay;
  region: RegionType;
  partyLevel: number; // 1..20
  partySize: number; // 1..8
  mode: TravelMode;
  campfire: boolean;
  noise: boolean;
}

export interface Weather {
  temp: Temperature;
  precip: Precipitation;
  wind: Wind;
  narrative: string;
  effects: WeatherEffect[];
}

export interface WeatherEffect {
  id: string;
  text: string;
  source: 'SRD' | 'Original';
}

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface NamedDesc {
  name: string;
  desc: string;
}

export interface Monster {
  slug: string;
  name: string;
  cr: number;
  type: string;
  size: string;
  environments: Environment[];
  hp: number;
  hitDice?: string;
  ac: number;
  acDetail?: string;
  speed: string;
  category: MonsterCategory;
  // Source edition. Slug is bare across editions so categoriser overrides match either source;
  // edition is tracked separately so rename detection and edition-aware dedupe are possible.
  edition?: '5.1' | '5.2';

  // Rich stat-block fields. All optional so older snapshots and test fixtures still work.
  alignment?: string;
  proficiencyBonus?: number;
  xp?: number;
  abilityScores?: AbilityScores;
  savingThrows?: Record<string, number>;
  skills?: Record<string, number>;
  damageResistances?: string;
  damageImmunities?: string;
  damageVulnerabilities?: string;
  conditionImmunities?: string;
  senses?: string;
  passivePerception?: number;
  languages?: string;
  traits?: NamedDesc[];
  actions?: NamedDesc[];
  bonusActions?: NamedDesc[];
  reactions?: NamedDesc[];
  legendaryActions?: NamedDesc[];
  legendaryDesc?: string;
}

// Intermediate shape produced by fetch-monsters before categorise runs.
// On-disk monsters.json is always post-categorise (see npm script chain),
// so the engine only ever loads Monster, never MonsterRaw.
export type MonsterRaw = Omit<Monster, 'category'>;

export interface Encounter {
  creature: Monster;
  count: number;
  narrative: string;
  contributingModifiers: string[];
}

export interface RollResult {
  seed: number;
  weather: Weather;
  encounter: Encounter | null;
  encounterMessage: string | null; // populated when encounter is null
}

export interface ModifierRule {
  id: string;
  when: Partial<{
    climate: Climate;
    environment: Environment;
    season: Season;
    time: TimeOfDay;
    region: RegionType;
    mode: TravelMode;
    campfire: boolean;
    noise: boolean;
    weatherSeverity: 'Mild' | 'Severe';
  }>;
  encounterChanceMultiplier?: number;
  categoryMultipliers?: Partial<Record<MonsterCategory, number>>;
  narrativeFragment?: string;
}
