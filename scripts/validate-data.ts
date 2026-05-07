/**
 * Run the runtime validators against the bundled data files. Exits non-zero on
 * shape drift so CI catches a malformed monsters.json or encounter-modifiers.json
 * at build time, not in the browser on first roll.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMonsterCatalog, parseModifiersFile } from '../src/lib/engine/validate';

function loadJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), rel), 'utf8'));
}

let failed = false;

try {
  const monsters = parseMonsterCatalog(loadJson('src/lib/data/monsters.json'));
  console.log(`monsters.json: ${monsters.length} entries OK`);
} catch (e) {
  console.error(`monsters.json: ${(e as Error).message}`);
  failed = true;
}

try {
  const modifiers = parseModifiersFile(loadJson('src/lib/data/encounter-modifiers.json'));
  console.log(`encounter-modifiers.json: ${modifiers.rules.length} rules OK`);
} catch (e) {
  console.error(`encounter-modifiers.json: ${(e as Error).message}`);
  failed = true;
}

if (failed) process.exit(1);
