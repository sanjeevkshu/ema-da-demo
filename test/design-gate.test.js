/*
 * Design gate governance (runs in `npm test`, every build):
 * the gate config is well formed and never looser at a higher destination,
 * and the code-level checks catch what they are meant to catch.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  parseColor, literalCounts, orphanGridRules, checkTokens, checkCoverage, rules,
} from './design/static.mjs'; // eslint-disable-line import/extensions
import {
  fingerprint, itemsFromXml, itemsFromRest, mappedNodes,
} from './design/drift.mjs'; // eslint-disable-line import/extensions

const config = JSON.parse(readFileSync('reference/design/gate.config.json', 'utf8'));
const LEVELS = ['off', 'report', 'block'];
const LAYERS = ['tokens', 'responsive', 'product', 'specs', 'coverage', 'visual-main', 'visual-figma'];

describe('gate config', () => {
  test('every layer has a known level for every destination and nightly', () => {
    assert.deepEqual(Object.keys(config.layers).sort(), [...LAYERS].sort());
    Object.entries(config.layers).forEach(([layer, l]) => {
      [...config.destinations, 'nightly'].forEach((d) => {
        assert.ok(LEVELS.includes(l[d]), `${layer}.${d} is "${l[d]}"`);
      });
      assert.ok(l.what, `${layer} says what it checks`);
    });
  });

  test('a higher destination is never looser than a lower one', () => {
    const rank = (lvl) => LEVELS.indexOf(lvl);
    Object.entries(config.layers).forEach(([layer, l]) => {
      for (let i = 1; i < config.destinations.length; i += 1) {
        const lower = config.destinations[i - 1];
        const higher = config.destinations[i];
        assert.ok(rank(l[higher]) >= rank(l[lower]), `${layer}: ${higher} (${l[higher]}) is looser than ${lower} (${l[lower]})`);
      }
    });
  });

  test('promoted Figma pages have an approved baseline and keep promotion upward', () => {
    const { promoted } = config.layers['visual-figma'];
    const pages = JSON.parse(readFileSync('.github/page-types.json', 'utf8'))
      .map((t) => (t.path === '/' ? 'index' : t.path.slice(1)));
    Object.entries(promoted).forEach(([dest, list]) => list.forEach((slug) => {
      assert.ok(pages.includes(slug), `${slug} is a page type`);
      config.widths.forEach((w) => assert.ok(existsSync(`reference/design/baselines/${slug}-${w}.png`), `${slug}-${w}.png approved`));
      const higher = config.destinations.slice(config.destinations.indexOf(dest) + 1);
      higher.forEach((h) => assert.ok(promoted[h].includes(slug), `${slug} promoted on ${dest} but not on ${h}`));
    }));
  });

  test('widths are the Figma phone, tablet and desktop frames', () => {
    assert.deepEqual(config.widths, [390, 768, 1440]);
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
