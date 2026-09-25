#!/usr/bin/env node
/*
 * Builds the Document Authoring (DA) library from the site's own content.
 *
 *  - Block docs: one doc per block in blocks/, holding one real example per
 *    variant the code supports (taken from the DA source of each page), each followed
 *    by a library-metadata description from library.config.json.
 *  - Template docs: one per page type. Pages that use the same ordered set of
 *    blocks are one type; the representative page becomes the template.
 *  - blocks.json / templates.json sheets for the DA library config.
 *
 * Usage: node .claude/skills/da-library/build-library.mjs [--check]
 *   --check  only validate library.config.json against blocks/ (no output)
 * Output: migration-work/da-library/ (local only; upload with SKILL.md step 3)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const PAGE_BLOCKS_IGNORED = ['metadata', 'section-metadata', 'library-metadata'];

export function loadConfig(file = path.join(HERE, 'library.config.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Splits .plain.html into top-level sections and the blocks directly inside
 * them. Nested blocks are ignored: EDS only decorates top-level blocks.
 */
export function parseSections(html) {
  const sections = [];
  const tag = /<div\b([^>]*)>|<\/div>/g;
  let depth = 0;
  let section = null;
  let block = null;
  let m = tag.exec(html);
  while (m) {
    if (m[0] !== '</div>') {
      if (depth === 0) section = { start: m.index, blocks: [] };
      if (depth === 1) {
        const cls = /class="([^"]*)"/.exec(m[1]);
        if (cls) {
          const [name, ...variants] = cls[1].trim().split(/\s+/);
          block = { name, variants, start: m.index };
        }
      }
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 1 && block) {
        block.html = html.slice(block.start, tag.lastIndex);
        section.blocks.push(block);
        block = null;
      }
      if (depth === 0 && section) {
        section.html = html.slice(section.start, tag.lastIndex);
        sections.push(section);
        section = null;
      }
    }
    m = tag.exec(html);
  }
  return sections;
}

/** Variant classes the block's CSS or JS actually handles. */
export function codeVariants(name, blocksDir = path.join(ROOT, 'blocks')) {
  const read = (ext) => {
    const f = path.join(blocksDir, name, `${name}.${ext}`);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  };
  const found = new Set();
  const css = read('css');
  // chained selectors count too: `.hero.center-hero.drop` supports both
  const cssRe = new RegExp(`\\.${name}((?:\\.[a-z][a-z0-9-]*)+)`, 'g');
  [...css.matchAll(cssRe)].forEach(([, chain]) => chain.split('.').filter(Boolean).forEach((v) => found.add(v)));
  const js = read('js');
  [...js.matchAll(/classList\.contains\('([a-z][a-z0-9-]*)'\)/g)].forEach(([, v]) => found.add(v));
  return [...found].sort();
}

export function blockDirs(blocksDir = path.join(ROOT, 'blocks')) {
  return fs.readdirSync(blocksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(blocksDir, d.name, `${d.name}.js`)))
    .map((d) => d.name)
    .sort();
}

/**
 * Library config must describe every block and every code-supported variant,
 * so a new block or variant can't ship without a library entry.
 */
export function checkConfig(config, blocksDir = path.join(ROOT, 'blocks')) {
  const problems = [];
  const dirs = blockDirs(blocksDir);
  dirs.forEach((name) => {
    if (config.excludedBlocks[name]) return;
    const entry = config.blocks[name];
    if (!entry) {
      problems.push(`blocks/${name}: no entry in library.config.json (add it to "blocks" or "excludedBlocks")`);
      return;
    }
    if (!entry.name || !entry.description) problems.push(`blocks/${name}: needs "name" and "description"`);
    codeVariants(name, blocksDir).forEach((v) => {
      if (!entry.variants || !entry.variants[v]) {
        problems.push(`blocks/${name}: variant "${v}" is styled in code but has no description in "variants"`);
      }
    });
  });
  [...Object.keys(config.blocks), ...Object.keys(config.excludedBlocks)].forEach((name) => {
    if (!dirs.includes(name)) problems.push(`library.config.json: "${name}" has no blocks/${name}/ folder`);
  });
  return problems;
}

function cellsToBlock(className, rows) {
  const body = rows.map((cells) => `<div>${cells.map((c) => `<div>${c}</div>`).join('')}</div>`).join('');
  return `<div class="${className}">${body}</div>`;
}

export function libraryMetadata(description) {
  return cellsToBlock('library-metadata', [['<p>description</p>', `<p>${escapeHtml(description)}</p>`]]);
}

export function wrapDocument(inner) {
  return `<body>\n  <header></header>\n  <main>\n${inner}\n  </main>\n  <footer></footer>\n</body>\n`;
}

/** Swaps the block's class attribute for the normalised one. */
function withClass(blockHtml, className) {
  return blockHtml.replace(/^<div\b[^>]*>/, `<div class="${className}">`);
}

/** Replaces page-specific metadata values so templates don't leak them. */
export function placeholderMetadata(html) {
  const values = { title: 'Page title', description: 'One or two sentences that describe the page.' };
  const meta = parseSections(html).flatMap((s) => s.blocks).find((b) => b.name === 'metadata');
  if (!meta) return html;
  const row = /(<div>\s*<div>\s*(?:<p>)?\s*(title|description)\s*(?:<\/p>)?\s*<\/div>\s*<div>)[\s\S]*?(?=<\/div>)/g;
  const replaced = meta.html.replace(row, (all, prefix, key) => `${prefix}<p>${values[key]}</p>`);
  return html.replace(meta.html, replaced);
}

/** Home first, then pages alphabetically. */
export function orderPages(slugs) {
  return [...slugs].sort((a, b) => {
    if (a === 'index') return -1;
    if (b === 'index') return 1;
    return a.localeCompare(b);
  });
}

export function pageSignature(sections) {
  const names = [];
  sections.forEach((s) => s.blocks.forEach((b) => {
    if (!PAGE_BLOCKS_IGNORED.includes(b.name) && !names.includes(b.name)) names.push(b.name);
  }));
  return names;
}

export function groupPageTypes(pages, templateNames) {
  const types = new Map();
  pages.forEach((p) => {
    const key = p.signature.join(',');
    if (!types.has(key)) types.set(key, { signature: p.signature, pages: [] });
    types.get(key).pages.push(p.slug);
  });
  return [...types.values()].map((t) => {
    const representative = t.pages.find((s) => templateNames[s]) || t.pages[0];
    return { ...t, representative, name: templateNames[representative] || representative };
  });
}

/**
 * Reads `<slug>.plain.html` (local mirror) or `<slug>.html` (DA source, a full
 * document: only the <main> content is kept).
 */
export function readPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.plain.html')) return html;
  const body = /<main>([\s\S]*)<\/main>/.exec(html);
  return body ? body[1].trim() : html;
}

function readPages(config, contentDir) {
  const files = new Map();
  fs.readdirSync(contentDir).filter((f) => f.endsWith('.html')).forEach((f) => {
    files.set(f.replace(/(\.plain)?\.html$/, ''), path.join(contentDir, f));
  });
  const slugs = [...files.keys()].filter((s) => !config.excludedPages.includes(s));
  return orderPages(slugs).map((slug) => {
    const html = readPage(files.get(slug));
    const sections = parseSections(html);
    return {
      slug, html, sections, signature: pageSignature(sections),
    };
  });
}

/** One example per supported variant combination, first page wins. */
export function collectExamples(pages, name, supported) {
  const examples = new Map();
  pages.forEach((p) => p.sections.forEach((s) => s.blocks.forEach((b) => {
    if (b.name !== name) return;
    const variants = b.variants.filter((v) => supported.includes(v)).sort();
    const key = variants.join(' ');
    if (!examples.has(key)) examples.set(key, { variants, html: b.html, page: p.slug });
  })));
  return [...examples.values()].sort((a, b) => a.variants.length - b.variants.length);
}

function describe(entry, variants) {
  if (!variants.length) return entry.description;
  const parts = variants.map((v) => (entry.variants && entry.variants[v]) || '');
  return `${entry.name} (${variants.join(', ')}): ${parts.filter(Boolean).join(' ')}`;
}

export function build({
  config = loadConfig(), contentDir = path.join(ROOT, 'content'), blocksDir = path.join(ROOT, 'blocks'),
} = {}) {
  const pages = readPages(config, contentDir);
  const docs = {};
  const blockRows = [];
  const warnings = [];
  const blockReport = [];
  const base = `https://content.da.live/${config.org}/${config.site}/${config.libraryPath}`;

  const entries = [
    ...Object.entries(config.blocks).map(([n, e]) => [n, e, codeVariants(n, blocksDir)]),
    ...Object.entries(config.extraBlocks).map(([n, e]) => [n, e, []]),
  ];
  entries.forEach(([name, entry, supported]) => {
    let examples = entry.example
      ? entry.example.map((rows) => ({ variants: [], html: cellsToBlock(name, rows), page: 'library.config.json' }))
      : collectExamples(pages, name, supported);
    if (!examples.length) {
      warnings.push(`${name}: no example on any page and no "example" in library.config.json; left out`);
      return;
    }
    examples = examples.map((ex) => ({
      ...ex,
      html: withClass(ex.html, [name, ...ex.variants].join(' ')),
    }));
    const sections = examples.map((ex) => `<div>${ex.html}${libraryMetadata(describe(entry, ex.variants))}</div>`);
    docs[`${config.libraryPath}/blocks/${name}.html`] = wrapDocument(sections.join('\n'));
    blockRows.push({ name: entry.name, path: `${base}/blocks/${name}` });
    const sources = examples.map((ex) => ({ variants: ex.variants, from: ex.page }));
    blockReport.push({ block: name, examples: sources });
    supported.filter((v) => !examples.some((ex) => ex.variants.includes(v)))
      .forEach((v) => warnings.push(`${name}: variant "${v}" is supported in code but no page uses it`));
  });
  blockRows.sort((a, b) => a.name.localeCompare(b.name));

  const pageTypes = groupPageTypes(pages, config.templates);
  const templateRows = pageTypes.map((t) => {
    const page = pages.find((p) => p.slug === t.representative);
    docs[`${config.libraryPath}/templates/${t.representative}.html`] = wrapDocument(placeholderMetadata(page.html));
    return { key: t.name, value: `${base}/templates/${t.representative}` };
  });

  const sheet = (rows) => ({
    total: rows.length, limit: rows.length, offset: 0, data: rows,
  });
  const styles = config.sectionStyles.join(' | ');
  docs[`${config.libraryPath}/blocks.json`] = `${JSON.stringify({
    data: sheet(blockRows),
    options: sheet([{ key: 'style', blocks: 'section-metadata', values: styles }]),
    ':names': ['data', 'options'],
    ':version': 3,
    ':type': 'multi-sheet',
  }, null, 2)}\n`;
  docs[`${config.libraryPath}/templates.json`] = `${JSON.stringify({
    ...sheet(templateRows), ':sheetname': 'data', ':type': 'sheet',
  }, null, 2)}\n`;

  return {
    docs,
    report: {
      pageTypes: pageTypes.map(({
        name, representative, pages: members, signature,
      }) => ({
        name, representative, pages: members, blocks: signature,
      })),
      blocks: blockReport,
      warnings,
    },
  };
}

/* eslint-disable no-console -- CLI output */
function main() {
  const config = loadConfig();
  const problems = checkConfig(config);
  if (problems.length) {
    problems.forEach((p) => console.error(`✗ ${p}`));
    process.exit(1);
  }
  if (process.argv.includes('--check')) {
    console.log('library.config.json covers every block and variant');
    return;
  }
  // DA source copies keep the content.da.live image URLs the DA editor needs;
  // the local content/ mirror rewrites them to /media-da/ paths DA can't resolve.
  const contentDir = path.join(ROOT, 'migration-work', 'da-library-source');
  if (!fs.existsSync(contentDir)) {
    console.error(`✗ ${path.relative(ROOT, contentDir)}/ missing: fetch the DA sources first (SKILL.md step 2)`);
    process.exit(1);
  }
  const out = path.join(ROOT, 'migration-work', 'da-library');
  fs.rmSync(out, { recursive: true, force: true });
  const { docs, report } = build({ config, contentDir });
  Object.entries(docs).forEach(([rel, body]) => {
    const f = path.join(out, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  });
  fs.writeFileSync(path.join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${Object.keys(docs).length} files in ${path.relative(ROOT, out)}/`);
  report.pageTypes.forEach((t) => console.log(`  template ${t.name}: ${t.representative} (${t.pages.join(', ')})`));
  report.warnings.forEach((w) => console.log(`  ! ${w}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
