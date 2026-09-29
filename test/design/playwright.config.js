/*
 * Design compliance checks (the "Design (gate)" job): real browser against a
 * deployed host, at the Figma breakpoints. Run through test/design/run.mjs,
 * which applies the per-destination levels in reference/design/gate.config.json.
 *
 *   DESIGN_BASE_URL     site under test (default: main branch preview)
 *   DESIGN_COMPARE_URL  host to compare against for @visual-main (the PR's base branch)
 *
 * Tags: @responsive @specs @product @visual-main @visual-figma
 * See .claude/skills/design-compliance/SKILL.md.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 120000,
  expect: { timeout: 15000 },
  retries: process.env.CI ? 1 : 0,
  workers: 3,
  reporter: [
    ['list'],
    ['json', { outputFile: 'design-results.json' }],
    ['html', { open: 'never', outputFolder: 'design-report' }],
  ],
  use: {
    baseURL: process.env.DESIGN_BASE_URL || 'https://main--ema-da-demo--sanjeevkshu.aem.page',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
