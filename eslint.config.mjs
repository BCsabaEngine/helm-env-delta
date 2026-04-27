import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/.DS_Store',
      '**/node_modules',
      '**/coverage',
      '**/bin',
      '**/dist',
      '**/demo',
      '**/.env',
      '**/.env.*',
      '!**/.env.example',
      '**/pnpm-lock.yaml',
      '**/package-lock.json',
      '**/yarn.lock'
    ]
  },
  js.configs.recommended,
  ...typescriptEslint.configs['flat/recommended'],
  eslintConfigPrettier,
  unicorn.configs.all,
  {
    plugins: {
      'simple-import-sort': simpleImportSort
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },

      ecmaVersion: 2023,
      sourceType: 'module'
    },

    rules: {
      curly: ['error', 'multi'],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unicorn/filename-case': 'off',
      'unicorn/no-process-exit': 'off',
      'unicorn/switch-case-braces': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/no-nested-ternary': 'off',
      'no-alert': 'error',
      'no-debugger': 'error',
      // type-imports — explicit import type for type-only imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports'
        }
      ],
      // TS-aware replacement for base no-shadow (understands enums/types)
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      // property-style method signatures are more type-safe (no bivariance)
      '@typescript-eslint/method-signature-style': ['error', 'property']
    }
  },
  // Type-aware rules — only for src/ which is covered by tsconfig.json
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // exhaustive switches on discriminated unions (CommandName, ChangeMode, etc.)
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          considerDefaultExhaustiveForUnions: true
        }
      ],
      // flag always-true/false conditions (dead defensive checks on non-nullable types)
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          allowConstantLoopConditions: true
        }
      ],
      // class props never reassigned after construction should be readonly
      '@typescript-eslint/prefer-readonly': 'error',
      // require explicit comparator in .sort() — locale-dependent otherwise
      '@typescript-eslint/require-array-sort-compare': [
        'error',
        {
          ignoreStringArrays: true
        }
      ],
      // un-awaited promises
      '@typescript-eslint/no-floating-promises': 'error',
      // type assertions the compiler already knows are unnecessary
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // union types with redundant constituents (e.g. string | unknown)
      '@typescript-eslint/no-redundant-type-constituents': 'error'
    }
  }
];
