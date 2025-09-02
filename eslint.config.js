import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

export default [
  // Base recommended config
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'lib/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      'packages/*/lib/**',
      'packages/*/dist/**',
      '**/temp/**',
      '**/.next/**',
      '**/.nx/**',
      'docs/**',
      'storybook-static/**',
      '.storybook/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.setup.js',
      'jest.config.js',
      'lint-staged.config.js',
      'scripts/**',
    ],
  },

  // JavaScript files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        browser: true,
        node: true,
        jest: true,
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true,
        test: true,
      },
    },
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // React rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Custom rules from original config
      indent: 0,
      'no-dupe-class-members': 0,
      'no-unused-vars': 0,
      'comma-dangle': [
        2,
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'only-multiline',
          exports: 'only-multiline',
          functions: 'only-multiline',
        },
      ],
      'import/prefer-default-export': 0,
      'no-async-promise-executor': 0,
      'no-bitwise': [
        0,
        {
          allow: ['~'],
          int32Hint: true,
        },
      ],
      'no-multiple-empty-lines': [
        2,
        {
          max: 1,
        },
      ],
      'no-trailing-spaces': 2,
      'padding-line-between-statements': [
        2,
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: '*',
        },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          prev: 'directive',
          next: '*',
        },
        {
          blankLine: 'any',
          prev: 'directive',
          next: 'directive',
        },
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-const',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-expression',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-let',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-var',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'switch',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'import',
          next: '*',
        },
        {
          blankLine: 'any',
          prev: 'import',
          next: 'import',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'case',
        },
        {
          blankLine: 'any',
          prev: 'case',
          next: 'case',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'default',
        },
        {
          blankLine: 'any',
          prev: 'case',
          next: 'default',
        },
      ],
      'prefer-arrow-callback': [
        2,
        {
          allowNamedFunctions: true,
        },
      ],
      quotes: [2, 'single'],
      'quote-props': [2, 'as-needed'],
    },
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: false, // Disable type-aware linting to reduce memory usage
      },
      globals: {
        browser: true,
        node: true,
        jest: true,
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true,
        test: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // TypeScript recommended rules
      '@typescript-eslint/no-unused-vars': [
        2,
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/prefer-as-const': 'error',
      
      // React rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Disable base rules that are handled by TypeScript equivalents
      indent: 'off', // Disable indent rule to prevent stack overflow in complex JSX
      'no-dupe-class-members': 'off',
      'no-unused-vars': 'off',
      
      // Custom rules from original config
      'comma-dangle': [
        2,
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'only-multiline',
          exports: 'only-multiline',
          functions: 'only-multiline',
        },
      ],
      'import/prefer-default-export': 0,
      'no-async-promise-executor': 0,
      'no-bitwise': [
        0,
        {
          allow: ['~'],
          int32Hint: true,
        },
      ],
      'no-multiple-empty-lines': [
        2,
        {
          max: 1,
        },
      ],
      'no-trailing-spaces': 2,
      'padding-line-between-statements': [
        2,
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
        {
          blankLine: 'always',
          prev: ['const', 'let', 'var'],
          next: '*',
        },
        {
          blankLine: 'any',
          prev: ['const', 'let', 'var'],
          next: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          prev: 'directive',
          next: '*',
        },
        {
          blankLine: 'any',
          prev: 'directive',
          next: 'directive',
        },
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-const',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-expression',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-let',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'multiline-var',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'switch',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'import',
          next: '*',
        },
        {
          blankLine: 'any',
          prev: 'import',
          next: 'import',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'case',
        },
        {
          blankLine: 'any',
          prev: 'case',
          next: 'case',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'default',
        },
        {
          blankLine: 'any',
          prev: 'case',
          next: 'default',
        },
      ],
      'prefer-arrow-callback': [
        2,
        {
          allowNamedFunctions: true,
        },
      ],
      quotes: [2, 'single'],
      'quote-props': [2, 'as-needed'],
    },
  },

  // Test files
  {
    files: ['**/*.spec.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', '**/__test__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-ignore': 0,
      'import/no-extraneous-dependencies': 0,
    },
  },
];