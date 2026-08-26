// Root ESLint 9 flat config covering all workspaces (web, server, shared).
// React-specific rules apply only to web/. Prettier handles formatting, so
// eslint-config-prettier disables any stylistic rules that would conflict.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'server/data/**',
      'docs/**',
      '.agents/**',
      '.claude/**',
      // Sprint machinery and its scratch patch scripts (git-excluded).
      '.proactive/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Web app: browser globals + React rules (rules pinned by name rather than
  // preset objects so they survive plugin preset-shape changes across majors).
  {
    files: ['web/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      // New JSX transform: no `import React` needed.
      ...react.configs.flat['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },

  // Disposable practice server: Node globals.
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Node-context config files at workspace roots (vite.config.ts etc.), and
  // the build scripts in scripts/ — those run under node, not in a browser.
  {
    files: ['*.{js,cjs,mjs}', '*/*.config.{js,ts,cjs,mjs}', 'scripts/**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // scripts/bill-gallery-entry.ts is compiled by esbuild and runs in the
  // browser, so it needs the browser globals rather than node's.
  {
    files: ['scripts/*-entry.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Must stay last: turns off rules that conflict with Prettier formatting.
  prettier,
);
