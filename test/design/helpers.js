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

/*
 * Which pages to test. PRs use the frozen fixture pages (reference/design/fixtures.json),
 * so any difference comes from code, never from authoring. The nightly run tests the
 * real pages visitors see (DESIGN_PAGES=live).
 */
export const MODE = process.env.DESIGN_PAGES || 'fixtures';
const FIXTURES = readJSON('reference/design/fixtures.json').pages;
const slugOf = (path) => (path === '/' ? 'index' : path.replace(/^\//, ''));

/** The page to load for a real page path, in the current mode. */
export function pathFor(realPath) {
  const fixture = FIXTURES[slugOf(realPath)];
  return MODE === 'fixtures' && fixture ? fixture.path : realPath;
}

/** Page types as [{ name, slug, path }] in the current mode. */
export const PAGES = PAGE_TYPES.map((t) => ({ name: t.name, slug: slugOf(t.path), path: pathFor(t.path) }));

/**
 * Loads a page the way a visitor sees it, with the consent banner declined,
 * every lazy section loaded, images decoded and animations settled.
 */
export async function loadPage(page, path, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const res = await page.goto(`${path}${path.includes('?') ? '&' : '?'}consent=decline`, { waitUntil: 'load' });
  // a missing page must fail, never pass as an empty layout (a folder's index lives at "/folder/")
  if (!res || res.status() !== 200 || /page not found/i.test(await page.title())) {
    throw new Error(`${path} did not load (HTTP ${res && res.status()}, title "${await page.title()}")`);
  }
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

/*
 * Colour-contrast waivers (reference/design/contrast-pairs.json) as rendered
 * colours: "#fg|#bg" → waiver. Translucent tokens are composited over the
 * surface they're declared over, else white. Lapsed waivers are left out.
 */
export function waivedColourPairs() {
  const tokens = readJSON('reference/design-tokens.json').base;
  const { pairs, waivers } = readJSON('reference/design/contrast-pairs.json');
  const rgba = (v) => {
    const h = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (h) {
      const x = h[1].length === 3 ? [...h[1]].map((c) => c + c).join('') : h[1];
      return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)).concat(1);
    }
    const m = v.match(/rgba?\(([^)]+)\)/);
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const a = p[3] === undefined ? 1 : parseFloat(p[3]) / (p[3].endsWith('%') ? 100 : 1);
    return [...p.slice(0, 3).map(Number), a];
  };
  const hex = (c, under = [255, 255, 255]) => `#${c.slice(0, 3).map((x, i) => Math.round(x * c[3] + under[i] * (1 - c[3])))
    .map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  const today = new Date().toISOString().slice(0, 10);
  const out = new Map();
  pairs.forEach((p) => {
    const w = waivers[`${p.fg} on ${p.bg} (${p.kind})`];
    if (!w || w.review < today) return;
    const bgRaw = rgba(tokens[p.bg]);
    const under = rgba(tokens[p.over || 'white']);
    const bg = rgba(hex(bgRaw, under));
    out.set(`${hex(rgba(tokens[p.fg]), bg)}|${hex(bgRaw, under)}`, w);
  });
  return out;
}

/** Short, readable description of an element for failure messages. */
export const describeEl = `(el) => {
  const cls = [...el.classList].slice(0, 2).join('.');
  const block = el.closest('.block');
  const text = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (block ? ' in .' + block.classList[0] : '') + (text ? ' "' + text + '"' : '');
}`;
