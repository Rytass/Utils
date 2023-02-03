module.exports = {
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
  modulePathIgnorePatterns: ['/lib/'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['packages/*/src/**/*', '!**/index.ts'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
