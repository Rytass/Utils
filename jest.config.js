module.exports = {
  transform: {
    '\\.ts$': 'ts-jest',
  },
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  moduleNameMapper: {
    '@rytass/([a-zA-Z-_/]*)$': '<rootDir>/packages/$1/src',
  },
  modulePathIgnorePatterns: ['/lib/'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['packages/*/src/**/*', '!**/index.ts'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
