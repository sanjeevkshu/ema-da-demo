/*
 * Consent gate (scripts/consent-check.js, consent-banner.js, consented.js):
 * nothing from Adobe before consent; the choice sticks; "Cookie settings"
 * changes it; withdrawing removes the assistant.
 */
import { test, expect } from '@playwright/test';
import { trackAdobe } from './helpers.js';

const banner = (page) => page.getByRole('dialog', { name: 'Cookies and Ask PULSE' });

test('first visit: the banner asks, and nothing from Adobe loads', async ({ page }) => {
  const adobe = trackAdobe(page);
  await page.goto('/pulse-loop');
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole('button', { name: 'Accept' })).toBeVisible();
  await expect(banner(page).getByRole('button', { name: 'Decline' })).toBeVisible();
  await expect(page.locator('.concierge-launcher')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(adobe).toEqual([]);
});

test('accepting shows Ask PULSE, and the choice survives a reload', async ({ page }) => {
  const adobe = trackAdobe(page);
  await page.goto('/pulse-loop');
  await banner(page).getByRole('button', { name: 'Accept' }).click();
  await expect(banner(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask PULSE' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ask PULSE' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(adobe, 'Adobe loads only when the chat opens').toEqual([]);
});

test('declining keeps the site working, with no assistant', async ({ page }) => {
  await page.goto('/pulse-loop');
  await banner(page).getByRole('button', { name: 'Decline' }).click();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator('.concierge-launcher')).toHaveCount(0);
  await expect(page.locator('main h2').first()).toBeVisible();
});

test('"Cookie settings" in the footer reopens the choice, and withdrawing removes Ask PULSE', async ({ page }) => {
  await page.goto('/pulse-loop');
  await banner(page).getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('button', { name: 'Ask PULSE' })).toBeVisible();
  await page.locator('footer').getByRole('link', { name: 'Cookie settings' }).click();
  await expect(banner(page)).toContainText('Your current choice: accepted');
  await banner(page).getByRole('button', { name: 'Decline' }).click();
  await expect(page.locator('.concierge-launcher')).toHaveCount(0);
  await page.locator('footer').getByRole('link', { name: 'Cookie settings' }).click();
  await banner(page).getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('button', { name: 'Ask PULSE' })).toBeVisible();
});

test('?consent=accept overrides for one view (used by the other specs)', async ({ page }) => {
  await page.goto('/pulse-loop?consent=accept');
  await expect(page.getByRole('button', { name: 'Ask PULSE' })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

for (const path of ['/contact', '/search']) {
  test(`no launcher on ${path}, even with consent`, async ({ page }) => {
    await page.goto(`${path}?consent=accept`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.concierge-launcher')).toHaveCount(0);
  });
}
