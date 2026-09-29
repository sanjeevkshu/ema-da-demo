/*
 * @specs — measured layout and style of each mapped block against the values
 * taken from its Figma node (reference/design/specs.json), at every width.
 */
import { test, expect } from '@playwright/test';
import {
  WIDTHS, loadPage, readJSON, pathFor,
} from './helpers.js';

const { $comment, ...specs } = readJSON('reference/design/specs.json');

for (const [block, spec] of Object.entries(specs)) {
  for (const width of WIDTHS) {
    test(`@specs ${block} on ${spec.page} at ${width}px (Figma ${Object.values(spec.figma).join(', ')})`, async ({ page }) => {
      await loadPage(page, pathFor(spec.page), width);
      for (const check of spec.checks) {
        if (check.widths && !check.widths.includes(width)) continue;
        const found = await page.evaluate(({ selector, props, gapFrom }) => {
          const els = [...document.querySelectorAll(selector)].filter((el) => el.getBoundingClientRect().width > 0);
          const rects = els.map((el) => el.getBoundingClientRect());
          const styles = els.map((el) => Object.fromEntries(props.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])));
          let gap = null;
          if (gapFrom && els[0]) {
            const from = document.querySelector(gapFrom);
            gap = from ? Math.round(rects[0].top - from.getBoundingClientRect().bottom) : null;
          }
          return {
            count: els.length,
            columns: new Set(rects.map((r) => Math.round(r.left))).size,
            sizes: rects.map((r) => [Math.round(r.width), Math.round(r.height)]),
            styles,
            gap,
          };
        }, { selector: check.selector, props: Object.keys(check.style || {}), gapFrom: check.gapAbove && check.gapAbove.from });

        const where = `${block}: ${check.selector} at ${width}px`;
        expect.soft(found.count, `${where} is missing`).toBeGreaterThan(0);
        if (!found.count) continue;
        if (check.count) expect.soft(found.count, `${where} count`).toBe(check.count);
        if (check.min) expect.soft(found.count, `${where} count`).toBeGreaterThanOrEqual(check.min);
        if (check.columns) expect.soft(found.columns, `${where} columns`).toBe(check.columns[width]);
        if (check.size) {
          found.sizes.forEach(([w, h]) => {
            if (check.size[0] !== null) expect.soft(w, `${where} width`).toBe(check.size[0]);
            if (check.size[1] !== null) expect.soft(h, `${where} height`).toBe(check.size[1]);
          });
        }
        if (check.style) {
          found.styles.forEach((s) => expect.soft(s, `${where} style`).toEqual(check.style));
        }
        if (check.gapAbove) expect.soft(found.gap, `${where} gap above`).toBe(check.gapAbove.px);
      }
    });
  }
}
