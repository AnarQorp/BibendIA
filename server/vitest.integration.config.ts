import { defineConfig } from 'vitest/config';
import { assertIsolatedTestDatabase } from './src/persistence/test-database-guard.js';

assertIsolatedTestDatabase(process.env);

export default defineConfig({
  test: { include: ['server/test/integration/**/*.test.ts'], environment: 'node', testTimeout: 15_000, fileParallelism: false },
});
