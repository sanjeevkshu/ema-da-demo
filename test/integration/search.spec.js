/* Query index + site search (reference/site-config/query.yaml, blocks/search). */
import { test, expect } from '@playwright/test';

test('the query index has the site pages and every search field', async ({ request }) => {
  const res = await request.get('/query-index.json');
  expect(res.status()).toBe(200);
  const { data, columns } = await res.json();
  for (const col of ['path', 'title', 'description', 'image', 'headings', 'content', 'robots', 'lastModified']) {
    expect(columns, `index column ${col}`).toContain(col);
  }
  const paths = data.map((r) => r.path);
  for (const path of ['/', '/pulse-loop', '/pulse-charge-dock', '/privacy', '/terms-of-service']) {
    expect(paths, `indexed ${path}`).toContain(path);
  }
  expect(paths).not.toContain('/search');
  expect(paths.filter((p) => p.startsWith('/docs/') || p.startsWith('/fragments/'))).toEqual([]);
});

test('/search finds pages by their spec-table text', async ({ page }) => {
  await page.goto('/search?q=battery');
  const results = page.locator('.search-result');
  await expect(results.first()).toBeVisible();
  const hrefs = await results.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const path of ['/pulse-loop', '/product-details', '/pulse-vision-ar']) expect(hrefs).toContain(path);
  await expect(page.locator('.search-status')).toContainText('results for “battery”');
});

test('search skips noindex pages and matches word starts', async ({ page }) => {
  await page.goto('/search?q=arc');
  await expect(page.locator('.search-result').first()).toBeVisible();
  const hrefs = await page.locator('.search-result').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs).toContain('/product-details');
  expect(hrefs).not.toContain('/lifestyle-vision'); // "Marcus" must not match "arc"
  for (const path of ['/about', '/article', '/landing-page', '/shop', '/product-detail-page']) expect(hrefs).not.toContain(path);
});

test('the header search submits to /search', async ({ page }) => {
  await page.goto('/pulse-loop');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const field = page.getByRole('searchbox', { name: 'Search the site' });
  await field.fill('titanium');
  await field.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=titanium/);
  await expect(page.locator('.search-result').first()).toBeVisible();
});
