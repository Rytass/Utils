const config = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^uuid$': '<rootDir>/jest.mocks/uuid.js',
    '^file-type$': '<rootDir>/jest.mocks/file-type.js',
    '@rytass/([a-zA-Z-_/]*)$': '<rootDir>/packages/$1/src',
  },
  transformIgnorePatterns: ['node_modules/(?!(file-type|strtok3|token-types|@tokenizer|uint8array-extras|uuid))/'],
  modulePathIgnorePatterns: ['/lib/'],
  collectCoverageFrom: [
    'packages/*/src/**/*',
    '!**/index.ts',
    // Exclude React components and hooks - these require React Testing Library
    '!**/components/**/*.tsx',
    '!**/components/**/*.ts',
    '!**/hooks/**/*.ts',
    '!**/icons/**/*.tsx',
    '!**/icons/**/*.ts',
    // Exclude Casbin configuration files
    '!**/constants/casbin-models/**/*.ts',
    // Exclude GraphQL DTO/Input types - decorators can't be tested with Jest
    '!**/dto/*input*.ts',
    // Exclude NestJS GraphQL module files - these require NestJS testing framework
    '!**/mutations/**/*.ts',
    '!**/queries/**/*.ts',
    '!**/resolvers/**/*.ts',
    '!**/data-loaders/**/*.ts',
    '!**/*.module.ts',
    // Exclude dto files with decorators
    '!**/dto/*.ts',
    '!**/dto/**/*.ts',
    // Exclude NestJS option providers and decorators
    '!**/option-providers.ts',
    '!**/resolved-repo-providers.ts',
    '!**/decorators/*.ts',
    // Exclude NestJS typings with symbols
    '!**/*-providers.ts',
    // Exclude NestJS controllers - require NestJS testing framework
    '!**/controllers/**/*.ts',
    // Exclude NestJS guards - require NestJS testing framework
    '!**/guards/**/*.ts',
    // Exclude TypeScript type declaration files
    '!**/types/**/*.d.ts',
    // Exclude member-base-nestjs-module services and models - require NestJS testing
    '!packages/member-base-nestjs-module/src/services/**/*.ts',
    '!packages/member-base-nestjs-module/src/models/**/*.ts',
  ],
};

export default config;
