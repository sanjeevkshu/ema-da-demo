/*
 * Applitools visual regression: every page type, on its frozen fixture page
 * (reference/design/fixtures.json), at 390/768/1440 via the Ultrafast Grid.
 */
import { test } from '@applitools/eyes-playwright/fixture'; // eslint-disable-line import/extensions -- package subpath export
import { readFileSync } from 'node:fs';

const { pages } = JSON.parse(readFileSync('reference/design/fixtures.json', 'utf8'));

Object.entries(pages).forEach(([slug, { type, path }]) => {
  test(`@visual ${type} (${slug})`, async ({ page, eyes }) => {
    const res = await page.goto(`${path}?consent=decline`, { waitUntil: 'load' });
    if (!res || res.status() !== 200) throw new Error(`${path} did not load (HTTP ${res && res.status()})`);
    await page.waitForFunction(() => document.body.classList.contains('appear'));
    // walk the page so lazy sections load before the DOM is captured
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => { setTimeout(r, 120); });
      }
      window.scrollTo(0, 0);
    });
    await eyes.check(type, { fully: true, matchLevel: 'Layout' });
  });
});
