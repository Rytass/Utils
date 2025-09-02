import { TextEncoder, TextDecoder } from 'util';

export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  globals: {
    TextEncoder,
    TextDecoder,
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }],
  },
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^uuid$': 'uuid',
    '^file-type$': '<rootDir>/jest.mocks/file-type.js',
    '@rytass/([a-zA-Z-_/]*)$': '<rootDir>/packages/$1/src',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(file-type|strtok3|token-types|@tokenizer|uint8array-extras))/'
  ],
  modulePathIgnorePatterns: ['/lib/'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['packages/*/src/**/*', '!**/index.ts'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
