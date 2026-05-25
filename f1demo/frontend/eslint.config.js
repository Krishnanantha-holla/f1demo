import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '.vite',
    'coverage',
    'node_modules',
    'e2e',
    'playwright.config.js',
    // WIP competitor-analysis pages from a parallel work stream — they
    // are not yet wired into App.jsx routes nor committed. Re-enable
    // linting on these once they're ready for review.
    'src/pages/HeadToHead.jsx',
    'src/pages/DriverStats.jsx',
    'src/pages/PUTracker.jsx',
    'src/pages/Strategy.jsx',
    'src/pages/PitStops.jsx',
    'src/pages/MiniSectors.jsx',
    'src/pages/TeamRadioNLP.jsx',
    'src/pages/TyreDegradation.jsx',
    'src/pages/Overtake.jsx',
    'src/pages/Results.jsx',
    'src/pages/TrackDNA.jsx',
    'src/pages/Consistency.jsx',
    'src/pages/analysis/RacePace.jsx',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Test files need vitest globals (vi, describe, it) and may run in node-like env
    files: ['**/__tests__/**', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        global: 'readonly',
      },
    },
  },
])
