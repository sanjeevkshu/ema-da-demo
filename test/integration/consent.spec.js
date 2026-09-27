/* Consent gate (scripts/consent-check.js, scripts/consented.js). */
import { test, expect } from '@playwright/test';
import { trackAdobe } from './helpers.js';

test('without consent, no concierge and no Adobe requests', async ({ page }) => {
  const adobe = trackAdobe(page);
  await page.goto('/pulse-loop');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.concierge-launcher')).toHaveCount(0);
  expect(adobe).toEqual([]);
});

test('with consent, the launcher appears but Adobe loads only on open', async ({ page }) => {
  const adobe = trackAdobe(page);
  await page.goto('/pulse-loop?consent=accept');
  await expect(page.getByRole('button', { name: 'Ask PULSE' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(adobe).toEqual([]);
});

for (const path of ['/contact', '/search']) {
  test(`no launcher on ${path}, even with consent`, async ({ page }) => {
    await page.goto(`${path}?consent=accept`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.concierge-launcher')).toHaveCount(0);
  });
}
