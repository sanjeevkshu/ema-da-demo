#!/usr/bin/env node
/*
 * Refreshes test/a11y/fixtures/<block>.html: the authored examples of every
 * block and variant, taken from the generated DA library (run the da-library
 * build first, which writes migration-work/da-library locally).
 *
 *   node test/a11y/fixtures.mjs
 */
import {
  readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync,
} from 'node:fs';

const SRC = 'migration-work/da-library/docs/library/blocks';
const OUT = 'test/a11y/fixtures';
const NOT_BLOCKS = ['metadata', 'section-metadata'];

if (!existsSync(SRC)) {
  console.error(`${SRC} not found: run the da-library build first (.claude/skills/da-library)`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
readdirSync(SRC).filter((f) => f.endsWith('.html')).forEach((f) => {
  const name = f.replace('.html', '');
  if (NOT_BLOCKS.includes(name)) return;
  const main = readFileSync(`${SRC}/${f}`, 'utf8').split('<main>')[1].split('</main>')[0];
  // keep the example sections, drop the library-metadata table each one carries
  const html = main.replace(/<div class="library-metadata">[\s\S]*?<\/div><\/div><\/div>(<\/div><\/div>)?/g, '')
    .replace(/https:\/\/content\.da\.live\/[^"]+/g, '/fixture.png')
    .trim();
  writeFileSync(`${OUT}/${name}.html`, `${html}\n`);
});
console.log(`fixtures written to ${OUT}`);
