/*
 * Headless accessibility lint, no browser (`npm run lint:a11y`, lint stage).
 * Every block's authored example (test/a11y/fixtures) is decorated by the
 * block's own code in jsdom, then checked with axe-core against WCAG 2.2 A/AA:
 * names, labels, roles, ARIA, alt text, list and heading structure.
 * Contrast and target size need a rendering engine: they're checked in the
 * design gate's @a11y layer (headless Chromium) and by test/a11y/contrast.test.js.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { installDom, mockFetch } from '../setup.js';

const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const SKIP = {
  fragment: 'loads another page at runtime; covered where it renders (header, footer)',
  search: 'fetches the query index at runtime; covered by the @a11y layer on /search',
};
// need layout, or only make sense for a whole page
const OFF = ['color-contrast', 'color-contrast-enhanced', 'target-size', 'region', 'landmark-one-main',
  'page-has-heading-one', 'document-title', 'html-has-lang', 'bypass', 'heading-order', 'scrollable-region-focusable'];

const fixtures = readdirSync('test/a11y/fixtures').filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));

describe('blocks pass axe-core (WCAG 2.2 A/AA) as authored and decorated', () => {
  fixtures.forEach((name) => {
    test(name, { skip: SKIP[name] }, async () => {
      const html = readFileSync(`test/a11y/fixtures/${name}.html`, 'utf8');
      const dom = installDom(`<!doctype html><html lang="en"><head><title>${name}</title></head><body>`
        + `<header></header><main>${html}</main><footer></footer></body></html>`);
      mockFetch({});
      const { default: decorate } = await import(`../../blocks/${name}/${name}.js`);
      const blocks = [...document.querySelectorAll(`main div.${name}`)];
      assert.ok(blocks.length, `fixture has a .${name} block`);
      for (const block of blocks) {
        block.classList.add('block');
        block.dataset.blockName = name;
        // eslint-disable-next-line no-await-in-loop
        await decorate(block);
      }
      dom.window.eval(AXE);
      const result = await dom.window.axe.run(document.querySelector('main'), {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        rules: Object.fromEntries(OFF.map((r) => [r, { enabled: false }])),
      });
      const violations = result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help} — ${v.nodes[0].target.join(' ')}`);
      assert.deepEqual(violations, []);
    });
  });
});
