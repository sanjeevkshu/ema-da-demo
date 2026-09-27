/* Header and footer fragments (blocks/header, blocks/footer: /nav, /footer). */
import { test, expect } from '@playwright/test';

test('header loads the nav fragment with search and Shop Now', async ({ page }) => {
  await page.goto('/pulse-loop');
  const nav = page.locator('header nav');
  await expect(nav.getByRole('link', { name: 'Know the Brand' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Shop Now' })).toBeVisible();
});

test('footer loads with its columns and the legal links', async ({ page }) => {
  await page.goto('/pulse-loop');
  const footer = page.locator('footer');
  await expect(footer.locator('.footer-columns .footer-col')).toHaveCount(4);
  const legal = footer.locator('.footer-bottom .footer-legal');
  await expect(legal.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  await expect(legal.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service');
});

for (const path of ['/privacy', '/terms-of-service']) {
  test(`${path} is published`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
  });
}

test('every product card links to its own page', async ({ page }) => {
  await page.goto('/product-discovery');
  const cards = page.locator('.productgrid-card');
  await expect(cards.first()).toBeVisible();
  const links = await cards.evaluateAll((cs) => cs.map((c) => [c.querySelector('.productgrid-name')?.textContent.trim(), c.querySelector('a')?.getAttribute('href')]));
  const hrefs = links.map(([, href]) => href);
  expect(new Set(hrefs).size, 'no two products share a page').toBe(hrefs.length);
  expect(hrefs).not.toContain(undefined);
});
