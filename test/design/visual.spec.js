/*
 * @visual-figma — every page type at every width against the approved Figma
 * frame export in reference/design/baselines/<page>-<width>.png. Pages without
 * an approved baseline are skipped with a note. Report-only until a page is
 * promoted in gate.config.json. (Before/after regression against the base
 * branch is the Applitools layer: test/visual.)
 */
import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import {
  PAGES, WIDTHS, config, loadPage,
} from './helpers.js';

const { visual } = config;

/** Share of pixels that differ (0..1) plus a diff image, computed in the browser. */
async function diff(page, a, b) {
  return page.evaluate(async ([pa, pb]) => {
    const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(pa), load(pb)]);
    const w = Math.min(ia.width, ib.width);
    const h = Math.min(ia.height, ib.height);
    const data = (img) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, w, h);
    };
    const da = data(ia);
    const db = data(ib);
    const out = new ImageData(w, h);
    let changed = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
      const hit = d > 48;
      if (hit) changed += 1;
      out.data[i] = hit ? 255 : da.data[i] / 3;
      out.data[i + 1] = hit ? 0 : da.data[i + 1] / 3;
      out.data[i + 2] = hit ? 0 : da.data[i + 2] / 3;
      out.data[i + 3] = 255;
    }
    const extra = Math.abs(ia.height - ib.height) * w; // height differences count as changed rows
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').putImageData(out, 0, 0);
    return { ratio: (changed + extra) / (w * Math.max(ia.height, ib.height)), png: c.toDataURL('image/png').split(',')[1] };
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
}

for (const type of PAGES) {
  for (const width of WIDTHS) {
    test(`@visual-figma ${type.slug} at ${width}px`, async ({ page }, info) => {
      const file = `reference/design/baselines/${type.slug}-${width}.png`;
      test.skip(!existsSync(file), `no approved Figma baseline (${file})`);
      await loadPage(page, type.path, width);
      const build = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      const figma = readFileSync(file);
      const { ratio, png } = await diff(page, build, figma);
      await info.attach('figma (approved baseline)', { body: figma, contentType: 'image/png' });
      await info.attach('build (this branch)', { body: build, contentType: 'image/png' });
      await info.attach('diff (red = differs)', { body: Buffer.from(png, 'base64'), contentType: 'image/png' });
      info.annotations.push({ type: 'figma match', description: `${(100 - ratio * 100).toFixed(1)}% of pixels match` });
      expect(ratio, `${type.slug} at ${width}px differs ${(ratio * 100).toFixed(1)}% from Figma`).toBeLessThanOrEqual(visual.maxFigmaDiff);
    });
  }
}
