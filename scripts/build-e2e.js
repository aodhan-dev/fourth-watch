#!/usr/bin/env node
// Builds the app with adapter-static for e2e testing, then restores the original config.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

sh('cp svelte.config.js svelte.config.js.bak');
sh('cp svelte.config.e2e.js svelte.config.js');
try {
  sh('npm run build');
} finally {
  sh('cp svelte.config.js.bak svelte.config.js');
  sh('rm -f svelte.config.js.bak');
}
