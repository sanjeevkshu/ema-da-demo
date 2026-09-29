/*
 * Applitools visual layer of the design gate (the "visual" job in pr-quality.yaml).
 * One DOM capture per page type, rendered by the Ultrafast Grid at the Figma widths
 * in Applitools' cloud, compared at Layout match level: structure and styling are
 * checked, copy and imagery are not (they belong to authoring).
 * Baselines branch per PR (branchName/parentBranchName), so approving a change in
 * one PR never moves another PR's or main's baseline.
 *
 *   APPLITOOLS_API_KEY  required (repository secret); without it the job skips
 *   DESIGN_BASE_URL     the PR's branch preview
 */
import { defineConfig } from '@playwright/test';

const branch = process.env.GITHUB_HEAD_REF || 'local';
const base = process.env.GITHUB_BASE_REF || 'main';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 180000,
  workers: 4,
  retries: 0,
  outputDir: 'test-results',
  reporter: [['list']],
  use: {
    baseURL: process.env.DESIGN_BASE_URL || 'https://main--ema-da-demo--sanjeevkshu.aem.page',
    viewport: { width: 1440, height: 900 },
    eyesConfig: {
      apiKey: process.env.APPLITOOLS_API_KEY,
      appName: 'PULSE',
      type: 'ufg',
      matchLevel: 'Layout',
      browsersInfo: [
        { name: 'chrome', width: 390, height: 844 },
        { name: 'chrome', width: 768, height: 1024 },
        { name: 'chrome', width: 1440, height: 900 },
      ],
      batch: { name: `PULSE design gate: ${branch}`, id: process.env.APPLITOOLS_BATCH_ID || `${branch}-${process.env.GITHUB_SHA || 'local'}` },
      branchName: `sanjeevkshu/ema-da-demo/${branch}`,
      parentBranchName: `sanjeevkshu/ema-da-demo/${base}`,
      failTestsOnDiff: 'afterAll',
    },
  },
});
