import { defineConfig } from '@playwright/test'

/**
 * End-to-end config for the twelve-step demonstration journey (T12.3).
 *
 * TradeReach has no worker queue: the app assumes a running `next dev` server and a
 * Supabase project already seeded by `scripts/seed.ts` (auth users + demo data). The
 * journey is read-only on purpose — it asserts the seeded mid-journey state (a draft
 * that trips the samples guardrail, an untriaged reply that splits technical/commercial)
 * and never fires a live AI call or a send, so it is deterministic and repeatable.
 *
 * Run it with `npm run test:e2e` while `npm run dev` is up (default port 3001 here) and
 * the Supabase demo project is reachable.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    // Use the system Chrome so the suite runs without `npx playwright install`
    // (the Playwright browser CDN is unreachable on some networks). Override with
    // E2E_CHANNEL=chromium after installing the bundled browser on CI.
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
})
