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
    '^uuid$': 'uuid',
    '^file-type$': '<rootDir>/jest.mocks/file-type.js',
    '@rytass/([a-zA-Z-_/]*)$': '<rootDir>/packages/$1/src',
  },
  transformIgnorePatterns: ['node_modules/(?!(file-type|strtok3|token-types|@tokenizer|uint8array-extras))/'],
  modulePathIgnorePatterns: ['/lib/'],
  collectCoverageFrom: ['packages/*/src/**/*', '!**/index.ts'],
};

export default config;
