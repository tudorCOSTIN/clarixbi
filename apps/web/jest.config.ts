import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageThreshold: {
    global: {
      lines: 60,
      statements: 60,
      functions: 55,
      branches: 50,
    },
  },
};

export default createJestConfig(config);
