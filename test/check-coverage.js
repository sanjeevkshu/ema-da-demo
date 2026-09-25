/*
 * Per-file coverage gate.
 *
 * `node --test --test-coverage-*` thresholds only check the aggregate, so a
 * well-covered block can hide one that is barely tested. This reads the lcov
 * report and fails when any file under blocks/ is below the threshold on
 * lines, branches or functions — or has no coverage record at all, which means
 * no test loads it.
 *
 * Usage: node test/check-coverage.js [path/to/lcov.info]   (default coverage/lcov.info)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const THRESHOLD = 80;
const lcovPath = process.argv[2] || 'coverage/lcov.info';

const out = (msg) => process.stdout.write(`${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`${msg}\n`);
  process.exitCode = 1;
};

if (!existsSync(lcovPath)) {
  fail(`coverage gate: ${lcovPath} not found. Run "npm run test:coverage".`);
  process.exit();
}

const pct = (hit, found) => (found === 0 ? 100 : (hit / found) * 100);

// one lcov record per source file: SF:<path> … LF/LH, BRF/BRH, FNF/FNH … end_of_record
const covered = new Map();
readFileSync(lcovPath, 'utf8').split('end_of_record').forEach((record) => {
  const sf = record.match(/^SF:(.+)$/m);
  if (!sf) return;
  const num = (tag) => Number((record.match(new RegExp(`^${tag}:(\\d+)$`, 'm')) || [])[1] || 0);
  covered.set(sf[1].trim().replace(/\\/g, '/'), {
    lines: pct(num('LH'), num('LF')),
    branches: pct(num('BRH'), num('BRF')),
    functions: pct(num('FNH'), num('FNF')),
  });
});

// every block script must be loaded by at least one test
const blockFiles = readdirSync('blocks', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join('blocks', d.name))
    .filter((f) => f.endsWith('.js'))
    .map((f) => `blocks/${d.name}/${f}`));

const reportFor = (file) => covered.get(file)
  || [...covered].find(([sf]) => sf.endsWith(`/${file}`))?.[1];

let failures = 0;
blockFiles.forEach((file) => {
  const c = reportFor(file);
  if (!c) {
    failures += 1;
    fail(`  ✖ ${file}: no coverage data — add a test that loads it`);
    return;
  }
  const low = Object.entries(c).filter(([, v]) => v < THRESHOLD);
  if (low.length) {
    failures += 1;
    fail(`  ✖ ${file}: ${low.map(([k, v]) => `${k} ${v.toFixed(1)}%`).join(', ')} (< ${THRESHOLD}%)`);
  }
});

if (failures) {
  fail(`coverage gate: ${failures} of ${blockFiles.length} block files below ${THRESHOLD}% per file.`);
} else {
  out(`coverage gate: all ${blockFiles.length} block files ≥ ${THRESHOLD}% lines, branches and functions.`);
}
