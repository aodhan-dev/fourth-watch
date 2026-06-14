import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  {
    ...js.configs.recommended,
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // File-size ceiling for DRY/SOLID + Qwen-harness patchability. WARN to start; ratchet to
      // error once the repo stays under it. See ~/.claude/templates/AGENTS.md.
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': ts },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.node }
    }
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.browser }
    }
  },
  {
    files: ['src/service-worker.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.serviceworker }
    }
  },
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        parser: tsParser
      }
    }
  },
  {
    files: ['tests/components/**/*.ts', 'tests/e2e/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.browser }
    }
  },
  { ignores: ['build/', '.svelte-kit/', 'node_modules/', 'test-results/'] }
];
