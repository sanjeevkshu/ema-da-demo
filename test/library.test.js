/*
 * The DA library (block and template pickers) is built from
 * .claude/skills/da-library/library.config.json. The config test fails the
 * build when a block or a code-supported variant has no library entry, so a
 * new block can't ship without one. See .claude/skills/da-library/SKILL.md.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  build, checkConfig, codeVariants, groupPageTypes, libraryMetadata, loadConfig,
  orderPages, pageSignature, parseSections, placeholderMetadata, readPage, wrapDocument,
  // eslint-disable-next-line import/extensions -- Node ESM script, not a browser module
} from '../.claude/skills/da-library/build-library.mjs';

describe('library config', () => {
  test('describes every block and every variant its code supports', () => {
    assert.deepEqual(checkConfig(loadConfig()), []);
  });
});

describe('library builder', () => {
  const page = '<div><h1>Hi</h1><div class="hero split"><div><div>a</div><div>b</div></div></div></div>'
    + '<div><div class="cards"><div><div>c</div></div></div>'
    + '<div class="section-metadata"><div><div>style</div><div>light</div></div></div></div>'
    + '<div><div class="metadata"><div><div>title</div><div>Real title</div></div>'
    + '<div><div>description</div><div>Real text</div></div></div></div>';

  test('parses top-level sections and their blocks only', () => {
    const nested = '<div><div class="columns"><div><div><div class="schedule"><div><div>x</div></div></div></div></div></div></div>';
    const sections = parseSections(nested);
    assert.equal(sections.length, 1);
    assert.deepEqual(sections[0].blocks.map((b) => b.name), ['columns']);
    const parsed = parseSections(page);
    assert.equal(parsed.length, 3);
    assert.deepEqual(parsed[0].blocks[0].variants, ['split']);
    assert.ok(parsed[0].blocks[0].html.endsWith('</div></div></div>'));
  });

  test('page signature ignores metadata blocks and repeats', () => {
    assert.deepEqual(pageSignature(parseSections(page + page)), ['hero', 'cards']);
  });

  test('groups pages with the same blocks into one type', () => {
    const types = groupPageTypes([
      { slug: 'a', signature: ['hero'] },
      { slug: 'b', signature: ['hero'] },
      { slug: 'c', signature: ['cards'] },
    ], { b: 'Bee' });
    assert.equal(types.length, 2);
    assert.equal(types[0].representative, 'b');
    assert.equal(types[0].name, 'Bee');
    assert.equal(types[1].name, 'c');
  });

  test('reads the <main> of a DA source document, or a .plain.html as is', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-'));
    fs.writeFileSync(path.join(tmp, 'a.html'), '<body><main>\n<div>x</div>\n</main></body>');
    fs.writeFileSync(path.join(tmp, 'b.plain.html'), '<div>y</div>');
    fs.writeFileSync(path.join(tmp, 'c.html'), '<div>z</div>');
    assert.equal(readPage(path.join(tmp, 'a.html')), '<div>x</div>');
    assert.equal(readPage(path.join(tmp, 'b.plain.html')), '<div>y</div>');
    assert.equal(readPage(path.join(tmp, 'c.html')), '<div>z</div>');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('home page sorts first', () => {
    assert.deepEqual(orderPages(['shop', 'index', 'about']), ['index', 'about', 'shop']);
  });

  test('templates get placeholder metadata', () => {
    const out = placeholderMetadata(page);
    assert.ok(!out.includes('Real title'));
    assert.ok(!out.includes('Real text'));
    assert.ok(out.includes('<p>Page title</p>'));
    assert.equal(placeholderMetadata('<div><p>x</p></div>'), '<div><p>x</p></div>');
  });

  test('library metadata and documents are DA-shaped', () => {
    assert.equal(
      libraryMetadata('a < b'),
      '<div class="library-metadata"><div><div><p>description</p></div><div><p>a &lt; b</p></div></div></div>',
    );
    assert.match(wrapDocument('<div></div>'), /^<body>\n {2}<header><\/header>\n {2}<main>/);
  });

  test('reads variants from chained CSS selectors and JS checks', () => {
    assert.ok(codeVariants('hero').includes('drop'));
    assert.ok(codeVariants('productgrid').includes('related'));
    assert.deepEqual(codeVariants('does-not-exist'), []);
  });

  test('builds block docs, templates and sheets from content', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-'));
    const blocksDir = path.join(tmp, 'blocks');
    const contentDir = path.join(tmp, 'content');
    ['hero', 'cards', 'stats'].forEach((b) => {
      fs.mkdirSync(path.join(blocksDir, b), { recursive: true });
      fs.writeFileSync(path.join(blocksDir, b, `${b}.js`), 'export default function decorate() {}');
    });
    fs.writeFileSync(path.join(blocksDir, 'hero', 'hero.css'), '.hero.split > div { display: grid; }');
    fs.mkdirSync(contentDir);
    fs.writeFileSync(path.join(contentDir, 'index.plain.html'), page);
    fs.writeFileSync(path.join(contentDir, 'nav.plain.html'), '<div><p>nav</p></div>');
    const config = {
      org: 'o',
      site: 's',
      libraryPath: 'docs/library',
      excludedPages: ['nav'],
      excludedBlocks: {},
      sectionStyles: ['light'],
      blocks: {
        hero: { name: 'Hero', description: 'Banner', variants: { split: 'Two columns' } },
        cards: { name: 'Cards', description: 'Grid' },
        stats: { name: 'Stats', description: 'Figures' },
      },
      extraBlocks: { metadata: { name: 'Metadata', description: 'Meta', example: [[['<p>title</p>', '<p>T</p>']]] } },
      templates: { index: 'Home' },
    };
    const { docs, report } = build({ config, contentDir, blocksDir });
    assert.match(docs['docs/library/blocks/hero.html'], /Hero \(split\): Two columns/);
    assert.match(docs['docs/library/blocks/metadata.html'], /class="metadata"/);
    assert.equal(docs['docs/library/blocks/stats.html'], undefined);
    assert.ok(report.warnings.some((w) => w.startsWith('stats:')));
    const sheet = JSON.parse(docs['docs/library/blocks.json']);
    assert.deepEqual(sheet.data.data.map((r) => r.name), ['Cards', 'Hero', 'Metadata']);
    assert.equal(sheet.options.data[0].values, 'light');
    const templates = JSON.parse(docs['docs/library/templates.json']);
    assert.deepEqual(templates.data, [{ key: 'Home', value: 'https://content.da.live/o/s/docs/library/templates/index' }]);
    assert.deepEqual(report.pageTypes[0].blocks, ['hero', 'cards']);
    assert.deepEqual(checkConfig(config, blocksDir), []);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('flags blocks and variants missing from the config', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'library-'));
    ['hero', 'newblock'].forEach((b) => {
      fs.mkdirSync(path.join(tmp, b));
      fs.writeFileSync(path.join(tmp, b, `${b}.js`), "block.classList.contains('dark');");
    });
    const problems = checkConfig({
      excludedBlocks: { gone: 'x' },
      blocks: { hero: { name: 'Hero', description: '' } },
    }, tmp);
    assert.equal(problems.length, 4);
    assert.ok(problems.some((p) => p.includes('blocks/newblock: no entry')));
    assert.ok(problems.some((p) => p.includes('needs "name" and "description"')));
    assert.ok(problems.some((p) => p.includes('variant "dark"')));
    assert.ok(problems.some((p) => p.includes('"gone" has no blocks/gone/')));
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
