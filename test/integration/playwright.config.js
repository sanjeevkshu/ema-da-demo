/*
 * System-integration checks: real browser, real network, against a deployed
 * host (the PR's branch preview in CI). See .claude/skills/integration-coverage.
 *
 *   INTEGRATION_BASE_URL  site under test (default: main branch preview)
 *   INTEGRATION_PROD_URL  production domain (robots/sitemap checks)
 *   INTEGRATION_LIVE_URL  *.aem.live host (noindex checks)
 *
 * Specs tagged @golden (grounded Brand Concierge answers) are report-only in
 * CI until grounding is fixed; everything else blocks PRs into main.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 90000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: process.env.INTEGRATION_BASE_URL || 'https://main--ema-da-demo--sanjeevkshu.aem.page',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
