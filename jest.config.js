module.exports = {
  testEnvironment: 'node',
  globals: {
    TextEncoder: require('util').TextEncoder,
    TextDecoder: require('util').TextDecoder,
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '\\.ts$': 'ts-jest',
    '^.+\\.tsx?$': [
      'ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'node'],
  moduleNameMapper: {
    '^uuid$': 'uuid',
    '@rytass/([a-zA-Z-_/]*)$': '<rootDir>/packages/$1/src',
  },
  transformIgnorePatterns: ['/node_modules/(?!bcp-47)/'],
  modulePathIgnorePatterns: ['/lib/'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['packages/*/src/**/*', '!**/index.ts'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
