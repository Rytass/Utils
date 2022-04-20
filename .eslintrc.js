module.exports = {
  env: {
    browser: true,
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
  ],
  plugins: [
    'import',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    indent: 0,
    'no-unused-vars': 0,
    'arrow-parens': [
      2,
      'as-needed',
      {
        requireForBlockBody: true,
      },
    ],
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
        allow: [
          '~',
        ],
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
        prev: [
          'const',
          'let',
          'var',
        ],
        next: '*',
      },
      {
        blankLine: 'any',
        prev: [
          'const',
          'let',
          'var',
        ],
        next: [
          'const',
          'let',
          'var',
        ],
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
    quotes: [
      2,
      'single',
    ],
    'quote-props': [2, 'as-needed'],
  },
  overrides: [
    {
      files: [
        './**/*.{ts}',
      ],
      extends: [
        'airbnb-typescript',
        'plugin:@typescript-eslint/recommended',
      ],
      plugins: [
        '@typescript-eslint',
      ],
      parserOptions: {
        project: './tsconfig.*?.json',
      },
      rules: {
        '@typescript-eslint/indent': [2, 2],
        '@typescript-eslint/no-unused-vars': [
          2,
          {
            varsIgnorePattern: '^_',
            argsIgnorePattern: '^_',
            ignoreRestSiblings: true,
          },
        ],
      },
    },
    {
      files: [
        './**/*.spec.{ts,tsx}',
      ],
      rules: {
        '@typescript-eslint/ban-ts-ignore': 0,
        'import/no-extraneous-dependencies': 0,
      },
    },
  ],
};
