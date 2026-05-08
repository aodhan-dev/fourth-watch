export type Rng = () => number;

// mulberry32: small, fast, well-distributed for non-crypto uses.
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 32-bit FNV-1a, sufficient for deriving sub-seeds.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deriveSeed(parent: number, label: string): number {
  // Mix parent through a multiply so parent=0 doesn't collapse the XOR step
  // to a no-op (the input string still differentiates parent=0 from parent=N,
  // but the mixing layer should also be active). 0x9e3779b9 is the golden-
  // ratio constant used by SplitMix and similar mixers.
  const a = fnv1a(`${parent}:${label}`);
  const b = Math.imul(parent ^ 0x9e3779b9, 0x85ebca6b);
  return (a ^ b) >>> 0;
}

// Convenience helpers built on top of an Rng.
//
// Contract: weights must be non-negative finite numbers. A negative weight is
// always a caller bug (it can poison the cumulative sum and bias the result),
// so pickIndex throws rather than silently producing garbage. An empty weights
// array or all-zero weights returns 0; encounterPick checks the all-zero case
// upstream so it can produce a useful "modifiers cancelled all categories"
// message instead of a silent zero pick.
export function pickIndex(rng: Rng, weights: number[]): number {
  let total = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0)
      throw new Error(`pickIndex: weight must be non-negative finite, got ${w}`);
    total += w;
  }
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function pickFrom<T>(rng: Rng, items: T[], weights?: number[]): T {
  if (items.length === 0) throw new Error('pickFrom: empty array');
  const w = weights ?? items.map(() => 1);
  return items[pickIndex(rng, w)];
}

export function rollD100(rng: Rng): number {
  return Math.floor(rng() * 100) + 1;
}
