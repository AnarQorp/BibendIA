import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['server/test/integration/**/*.test.ts'], environment: 'node', testTimeout: 15_000 },
});
