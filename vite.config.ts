import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    globals: true,
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/engine/**/*.test.ts', 'tests/*.test.ts'],
          environment: 'node'
        }
      },
      {
        extends: true,
        resolve: { conditions: ['browser'] },
        test: {
          name: 'component',
          include: ['tests/components/**/*.test.ts'],
          environment: 'happy-dom'
        }
      }
    ]
  }
});
