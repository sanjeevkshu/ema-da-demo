/* Shared helpers for the design compliance specs. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Playwright loads specs as CommonJS, so paths resolve from the repo root (where npm runs)
export const readText = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
export const readJSON = (path) => JSON.parse(readText(path));

export const config = readJSON('reference/design/gate.config.json');

/** Figma frame widths: phone, tablet, desktop. */
export const WIDTHS = config.widths;

/** One representative page per page type (written by the da-library build). */
export const PAGE_TYPES = readJSON('.github/page-types.json');

/**
 * Loads a page the way a visitor sees it, with the consent banner declined,
 * every lazy section loaded, images decoded and animations settled.
 */
export async function loadPage(page, path, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}consent=decline`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('appear'), null, { timeout: 30000 });
  // walk the page so lazy sections and images load
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 120); });
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll('main .section')].every((s) => s.dataset.sectionStatus === 'loaded'),
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => Promise.all([...document.images].map((i) => {
    i.loading = 'eager';
    return i.decode().catch(() => {});
  })));
  await page.evaluate(() => document.fonts.ready);
}

/** Short, readable description of an element for failure messages. */
export const describeEl = `(el) => {
  const cls = [...el.classList].slice(0, 2).join('.');
  const block = el.closest('.block');
  const text = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (block ? ' in .' + block.classList[0] : '') + (text ? ' "' + text + '"' : '');
}`;
