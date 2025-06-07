module.exports = {
  projects: [
    {
      displayName: 'server',
      testMatch: ['<rootDir>/packages/server/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@vscode-rest/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
      },
    },
    {
      displayName: 'client',
      testMatch: ['<rootDir>/packages/client/**/*.test.ts'],
      testEnvironment: 'jsdom',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@vscode-rest/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
      },
    },
    {
      displayName: 'shared',
      testMatch: ['<rootDir>/packages/shared/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
    },
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}; 