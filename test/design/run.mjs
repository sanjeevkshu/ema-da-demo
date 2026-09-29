#!/usr/bin/env node
/*
 * Design gate runner. Applies the levels in reference/design/gate.config.json
 * for one destination, runs the layers, and fails only on blocking layers.
 *
 *   node test/design/run.mjs --destination develop|main|nightly
 *   node test/design/run.mjs --update-baseline     rewrite the literal ratchet after a clean-up
 *
 * Env: DESIGN_BASE_URL (host under test), DESIGN_COMPARE_URL (base branch, for visual-main),
 *      PLAYWRIGHT_ARGS (extra args, e.g. a local browser config).
 */
import {
  readFileSync, writeFileSync, appendFileSync, existsSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { checkTokens, checkCoverage, updateBaseline } from './static.mjs';

const args = process.argv.slice(2);
if (args.includes('--update-baseline')) {
  writeFileSync('reference/design/css-baseline.json', `${JSON.stringify(updateBaseline(), null, 2)}\n`);
  console.log('reference/design/css-baseline.json updated');
  process.exit(0);
}
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const destination = flag('--destination', process.env.GITHUB_BASE_REF || 'nightly');
const config = JSON.parse(readFileSync('reference/design/gate.config.json', 'utf8'));
const level = (layer) => config.layers[layer][destination] || 'report';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const results = {}; // layer -> { level, passed, failed, skipped, problems: [], notes: [] }
const add = (layer, r) => {
  results[layer] = {
    level: level(layer), passed: 0, failed: 0, skipped: 0, problems: [], notes: [], ...r,
  };
};

// code-level layers
for (const [layer, check] of [['tokens', checkTokens], ['coverage', checkCoverage]]) {
  if (level(layer) === 'off') continue;
  const { problems, notes } = check('.');
  add(layer, {
    passed: problems.length ? 0 : 1, failed: problems.length ? 1 : 0, problems, notes,
  });
}

// browser layers
const browserLayers = ['responsive', 'product', 'specs', 'visual-main', 'visual-figma'].filter((l) => level(l) !== 'off');
if (browserLayers.length) {
  const grep = browserLayers.map((l) => `@${l} `).join('|');
  const pw = spawnSync('npx', ['playwright', 'test', '-c', process.env.DESIGN_PW_CONFIG || 'test/design/playwright.config.js', '--grep', grep,
    ...(process.env.PLAYWRIGHT_ARGS ? process.env.PLAYWRIGHT_ARGS.split(' ') : [])], { stdio: 'inherit' });
  const out = process.env.DESIGN_RESULTS || 'test/design/design-results.json';
  if (!existsSync(out)) { console.error(`no results at ${out} (playwright exit ${pw.status})`); process.exit(2); }
  const report = JSON.parse(readFileSync(out, 'utf8'));
  browserLayers.forEach((l) => add(l, {}));
  const promoted = new Set(((config.layers['visual-figma'].promoted || {})[destination]) || []);
  const walk = (suite) => {
    (suite.specs || []).forEach((spec) => spec.tests.forEach((t) => {
      const layer = (spec.title.match(/^@([a-z-]+)/) || [])[1];
      if (!results[layer]) return;
      const last = t.results[t.results.length - 1] || {};
      const status = t.status === 'flaky' ? 'passed' : (last.status || 'skipped');
      const r = results[layer];
      if (status === 'passed') r.passed += 1;
      else if (status === 'skipped') r.skipped += 1;
      else {
        r.failed += 1;
        const msg = (last.errors || []).map((e) => (e.message || '').replace(ANSI, '').split('\n')[0]).join('; ');
        const slug = (spec.title.match(/^@visual-figma (\S+)/) || [])[1];
        r.problems.push(`${spec.title.replace(/^@\S+ /, '')}: ${msg}${slug && promoted.has(slug) ? ' [promoted: blocks]' : ''}`);
        if (slug && promoted.has(slug)) r.promotedFailure = true;
      }
    }));
    (suite.suites || []).forEach(walk);
  };
  report.suites.forEach(walk);
}

// summary
const icon = (r) => {
  if (!r.failed) return '✅';
  return r.level === 'block' || r.promotedFailure ? '❌' : '⚠️';
};
const lines = [`## Design gate — ${destination}`, '', '| Layer | Level | Result | What it checks |', '|---|---|---|---|'];
Object.entries(results).forEach(([layer, r]) => {
  lines.push(`| ${layer} | ${r.level} | ${icon(r)} ${r.passed} passed, ${r.failed} failed${r.skipped ? `, ${r.skipped} skipped` : ''} | ${config.layers[layer].what} |`);
});
Object.entries(results).forEach(([layer, r]) => {
  if (r.problems.length || r.notes.length) {
    lines.push('', `### ${layer}`);
    r.problems.slice(0, 40).forEach((p) => lines.push(`- ${p}`));
    r.notes.forEach((n) => lines.push(`- note: ${n}`));
  }
});
const md = lines.join('\n');
console.log(`\n${md}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);

const blocking = Object.entries(results).filter(([, r]) => r.failed && (r.level === 'block' || r.promotedFailure));
Object.entries(results).filter(([, r]) => r.failed).forEach(([layer, r]) => {
  const kind = blocking.some(([l]) => l === layer) ? 'error' : 'warning';
  if (process.env.GITHUB_ACTIONS) console.log(`::${kind} title=Design gate (${layer}, ${r.level})::${r.problems.slice(0, 3).join(' | ').slice(0, 900)}`);
});
process.exit(blocking.length ? 1 : 0);
