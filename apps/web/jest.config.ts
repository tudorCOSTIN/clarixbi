import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  testEnvironment: 'jsdom',
};

export default createJestConfig(config);
