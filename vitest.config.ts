import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup-env.ts'],
    // Playwright specs live in e2e/ and are run by `npm run test:e2e`, not Vitest.
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
