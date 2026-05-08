type RngSource = () => number;

let source: RngSource = Math.random;

export function setRngSource(fn: RngSource): void {
  source = fn;
}

export function resetRngSource(): void {
  source = Math.random;
}

export function newSeed(): number {
  return Math.floor(source() * 0xffffffff) >>> 0;
}
