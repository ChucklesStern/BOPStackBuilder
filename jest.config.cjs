module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '<rootDir>/**/*.(test|spec).(ts|tsx|js)'
  ],
  collectCoverageFrom: [
    'client/src/**/*.{ts,tsx}',
    'server/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/*.config.*',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        types: ['jest', 'node']
      }
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts', '<rootDir>/__tests__/setup.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
};