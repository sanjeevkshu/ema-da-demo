/*
 * @a11y — rendered accessibility, in headless Chromium (no GUI): axe-core with
 * the WCAG 2.2 A/AA rules on every page type at the Figma widths. This is where
 * colour contrast, target size and focusable regions are checked on real layout,
 * which the no-browser lint (test/a11y) can't do.
 * A contrast failure passes only when its exact colours are a waived token pair
 * in reference/design/contrast-pairs.json (owner, reason, review date).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  PAGES, WIDTHS, loadPage, waivedColourPairs,
} from './helpers.js';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const WAIVED = waivedColourPairs();

for (const type of PAGES) {
  for (const width of WIDTHS) {
    test(`@a11y ${type.name} (${type.slug}) at ${width}px`, async ({ page }, info) => {
      await loadPage(page, type.path, width);
      const { violations } = await new AxeBuilder({ page })
        .withTags(TAGS)
        .exclude('#brand-concierge-mount') // third-party chat UI, loaded only after consent
        .analyze();
      const found = [];
      let waived = 0;
      violations.forEach((v) => {
        const nodes = v.id !== 'color-contrast' ? v.nodes : v.nodes.filter((n) => {
          const d = (n.any[0] || {}).data || {};
          const hit = WAIVED.has(`${String(d.fgColor).toLowerCase()}|${String(d.bgColor).toLowerCase()}`);
          if (hit) waived += 1;
          return !hit;
        });
        if (nodes.length) found.push(`${v.id} [${v.impact}] ×${nodes.length}: ${v.help} — ${nodes[0].target.join(' ')}`);
      });
      if (waived) info.annotations.push({ type: 'waived contrast', description: `${waived} element(s) use a waived token pair` });
      expect(found, `${type.slug} at ${width}px`).toEqual([]);
    });
  }
}
