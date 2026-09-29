/*
 * Design gate governance (runs in `npm test`, every build):
 * the gate config is well formed, with one level per layer for develop and main,
 * and the code-level checks catch what they are meant to catch.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseColor, literalCounts, orphanGridRules, checkTokens, checkCoverage, rules, offGridBreakpoints,
} from './design/static.mjs'; // eslint-disable-line import/extensions
import { decide } from './design/aggregate.mjs'; // eslint-disable-line import/extensions
import { build, normalize } from '../tokens/build.mjs'; // eslint-disable-line import/extensions
import {
  fingerprint, itemsFromXml, itemsFromRest, mappedNodes,
} from './design/drift.mjs'; // eslint-disable-line import/extensions

const config = JSON.parse(readFileSync('reference/design/gate.config.json', 'utf8'));
const LEVELS = ['off', 'report', 'block'];
const LAYERS = ['fixtures', 'responsive', 'a11y', 'specs', 'visual'];

describe('gate config', () => {
  test('every layer has one known level and says what it checks', () => {
    assert.deepEqual(Object.keys(config.layers).sort(), [...LAYERS].sort());
    Object.entries(config.layers).forEach(([layer, l]) => {
      assert.ok(LEVELS.includes(l.level), `${layer} level is "${l.level}"`);
      assert.ok(l.what, `${layer} says what it checks`);
    });
  });

  test('one bar for develop and main: no per-destination levels', () => {
    Object.entries(config.layers).forEach(([layer, l]) => {
      ['develop', 'main', 'nightly'].forEach((d) => assert.equal(l[d], undefined, `${layer} has a ${d} level`));
    });
  });

  test('widths are the Figma phone, tablet and desktop frames', () => {
    assert.deepEqual(config.widths, [390, 768, 1440]);
  });

  test('every page type has a frozen fixture page, previewed under /drafts', () => {
    const { pages } = JSON.parse(readFileSync('reference/design/fixtures.json', 'utf8'));
    JSON.parse(readFileSync('.github/page-types.json', 'utf8')).forEach((t) => {
      const slug = t.path === '/' ? 'index' : t.path.slice(1);
      assert.ok(pages[slug], `fixture for ${t.name}`);
      assert.match(pages[slug].path, /^\/drafts\/design-fixtures\//);
      assert.match(pages[slug].sha, /^[0-9a-f]{12}$/);
    });
    assert.equal(pages.index.path, '/drafts/design-fixtures/', 'a folder index is served at the folder URL');
  });
});

describe('the single required check', () => {
  const needs = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { result: v }]));
  test('skipped jobs pass; failed or cancelled jobs fail', () => {
    assert.equal(decide(needs({
      changes: 'success', preview: 'skipped', design: 'skipped', visual: 'skipped',
    }), config).ok, true);
    assert.equal(decide(needs({ design: 'failure', visual: 'success' }), config).ok, false);
    assert.equal(decide(needs({ preview: 'cancelled' }), config).ok, false);
  });
  test('Applitools differences only fail where the visual layer blocks', () => {
    const visualFails = needs({ design: 'success', visual: 'failure' });
    assert.equal(decide(visualFails, config).ok, config.layers.visual.level !== 'block');
    const strict = { ...config, layers: { ...config.layers, visual: { level: 'block' } } };
    assert.equal(decide(visualFails, strict).ok, false);
  });
});

describe('design tokens (Figma → Tokens Studio → Style Dictionary)', () => {
  // that the committed CSS/JSON match the tokens is `npm run tokens:check`, a Build step
  test('the Figma text styles survive as composite typography tokens', async () => {
    const { json } = await build();
    const { typography } = JSON.parse(json);
    assert.deepEqual(Object.keys(typography).length, 12);
    assert.equal(typography.display.letterSpacing, '-1.28px');
    assert.equal(typography.eyebrow.textTransform, 'uppercase');
  });
  test('Tokens Studio colour notations come out as stylelint expects', () => {
    assert.equal(normalize('#FFFFFF'), '#fff');
    assert.equal(normalize('#1D4ED8'), '#1d4ed8');
    assert.equal(normalize('rgba(17, 24, 39, 0.7)'), 'rgb(17 24 39 / 70%)');
    assert.equal(normalize('rgb(17,24,39)'), 'rgb(17 24 39)');
    assert.equal(normalize({ value: 16, unit: 'px' }), '16px');
  });
  test('media queries only use token breakpoints', () => {
    assert.deepEqual(offGridBreakpoints('@media (width <= 900px) {} @media (width < 768px) {}', [600, 900]), [768]);
  });
});

describe('code-level checks', () => {
  test('colours compare across hex, rgb() and rgba() syntaxes', () => {
    assert.deepEqual(parseColor('#111827'), [17, 24, 39, 1]);
    assert.deepEqual(parseColor('#fff'), [255, 255, 255, 1]);
    assert.deepEqual(parseColor('rgb(17 24 39 / 70%)'), [17, 24, 39, 0.7]);
    assert.deepEqual(parseColor('rgba(17,24,39,0.7)'), [17, 24, 39, 0.7]);
    assert.equal(parseColor('var(--x)'), null);
  });

  test('counts colour literals and raw font sizes, not tokens', () => {
    const css = '.a { color: #fff; background: rgb(0 0 0 / 5%); font-size: 13px; }\n'
      + '.b { color: var(--pulse-ink); font-size: var(--pulse-fs-body); } /* #abc in a comment */\n'
      + '.c { font-size: 1.2em; }';
    assert.deepEqual(literalCounts(css), { colors: 2, fontSizes: 1 });
  });

  test('flags a media rule that re-lays-out an element that is not the grid', () => {
    // the Contact and newsletter bug: the grid is on the row, the override on the block
    const broken = '.newsletter > div { display: grid; grid-template-columns: 1fr 1fr; }\n'
      + '@media (width <= 900px) { .newsletter { grid-template-columns: 1fr; } }';
    const fixed = '.newsletter > div { display: grid; grid-template-columns: 1fr 1fr; }\n'
      + '@media (width <= 900px) { .newsletter > div { grid-template-columns: 1fr; } }';
    assert.equal(orphanGridRules(broken).length, 1);
    assert.match(orphanGridRules(broken)[0], /"\.newsletter"/);
    assert.deepEqual(orphanGridRules(fixed), []);
  });

  test('parses nested media rules and comma selectors', () => {
    const r = rules('/* x */ .a, .b { color: red; } @media (width < 9px) { .c { top: 0; } }');
    assert.deepEqual(r.map((x) => [x.selectors, x.media]), [[['.a', '.b'], null], [['.c'], '@media (width < 9px)']]);
  });

  test('the site passes the tokens layer', () => {
    assert.deepEqual(checkTokens('.').problems, []);
  });

  test('every block and page type has a Figma source or a recorded reason', () => {
    assert.deepEqual(checkCoverage('.').problems, []);
  });
});

describe('Figma drift fingerprints', () => {
  const xml = '<frame id="2:417" name="contact-desktop" x="9201" y="-1450" width="1440" height="3528">\n'
    + '  <frame id="2:433" name="Split &amp; Contact" x="9201" y="-1370" width="1440" height="1745.4" />\n</frame>';
  const rest = {
    id: '2:417',
    type: 'FRAME',
    name: 'contact-desktop',
    absoluteBoundingBox: { width: 1440, height: 3528 },
    children: [{
      id: '2:433', type: 'FRAME', name: 'Split & Contact', absoluteBoundingBox: { width: 1440, height: 1745.4 },
    }],
  };

  test('the workspace (MCP XML) and CI (REST) sources give the same fingerprint', () => {
    assert.deepEqual(fingerprint(itemsFromXml(xml)), fingerprint(itemsFromRest(rest)));
  });

  test('a resized child changes the fingerprint', () => {
    const moved = xml.replace('height="1745.4"', 'height="1800"');
    assert.notEqual(fingerprint(itemsFromXml(moved)).hash, fingerprint(itemsFromXml(xml)).hash);
  });

  test('every mapped frame has a stored fingerprint', () => {
    const stored = JSON.parse(readFileSync('reference/design/figma-fingerprints.json', 'utf8')).nodes;
    [...mappedNodes().keys()].forEach((id) => assert.ok(stored[id], `no fingerprint for ${id}`));
  });
});
