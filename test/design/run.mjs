#!/usr/bin/env node
/*
 * Design gate runner. Applies the levels in reference/design/gate.config.json
 * for one destination, runs the layers, and fails only on blocking layers.
 *
 *   node test/design/run.mjs --destination develop|main|nightly [--width 390]
 *   node test/design/run.mjs --update-baseline     rewrite the literal ratchet after a clean-up
 *   node test/design/run.mjs --update-fixtures     re-approve the frozen fixture pages after a deliberate refresh
 *
 * --width runs one Figma width (CI runs the three in parallel); the code-level
 * layers and the fixture check run once, with the first width.
 * Env: DESIGN_BASE_URL (host under test), DESIGN_PAGES (fixtures | live),
 *      DESIGN_PW_CONFIG / DESIGN_RESULTS (local browser config), PLAYWRIGHT_ARGS.
 */
import {
  readFileSync, writeFileSync, appendFileSync, existsSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { checkTokens, checkCoverage, updateBaseline } from './static.mjs';

const args = process.argv.slice(2);
const BASE = process.env.DESIGN_BASE_URL || 'https://main--ema-da-demo--sanjeevkshu.aem.page';
const FIXTURES = 'reference/design/fixtures.json';
const plainUrl = (path) => `${BASE}${path.endsWith('/') ? `${path}index` : path}.plain.html`;
const sha = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);

/** Fixture pages whose content no longer matches the approved fingerprint. */
async function changedFixtures() {
  const { pages } = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  const out = [];
  for (const [slug, f] of Object.entries(pages)) {
    const res = await fetch(plainUrl(f.path));
    const now = res.ok ? sha(await res.text()) : `HTTP ${res.status}`;
    if (now !== f.sha) {
      out.push({
        slug, path: f.path, was: f.sha, now,
      });
    }
  }
  return out;
}

if (args.includes('--update-fixtures')) {
  const doc = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  for (const f of Object.values(doc.pages)) {
    f.sha = sha(await (await fetch(plainUrl(f.path))).text());
  }
  writeFileSync(FIXTURES, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`${FIXTURES} re-approved`);
  process.exit(0);
}
if (args.includes('--update-baseline')) {
  writeFileSync('reference/design/css-baseline.json', `${JSON.stringify(updateBaseline(), null, 2)}\n`);
  console.log('reference/design/css-baseline.json updated');
  process.exit(0);
}
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const destination = flag('--destination', process.env.GITHUB_BASE_REF || 'nightly');
const config = JSON.parse(readFileSync('reference/design/gate.config.json', 'utf8'));
const level = (layer) => config.layers[layer][destination] || 'report';
const width = flag('--width', null);
const firstShard = !width || Number(width) === config.widths[0];
const mode = process.env.DESIGN_PAGES || 'fixtures';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const results = {}; // layer -> { level, passed, failed, skipped, problems: [], notes: [] }
const add = (layer, r) => {
  results[layer] = {
    level: level(layer), passed: 0, failed: 0, skipped: 0, problems: [], notes: [], ...r,
  };
};

// code-level layers, once
for (const [layer, check] of [['tokens', checkTokens], ['coverage', checkCoverage]]) {
  if (level(layer) === 'off' || !firstShard) continue;
  const { problems, notes } = check('.');
  add(layer, {
    passed: problems.length ? 0 : 1, failed: problems.length ? 1 : 0, problems, notes,
  });
}

// the frozen fixtures must be unchanged, or differences could come from authoring
if (mode === 'fixtures' && firstShard && level('fixtures') !== 'off') {
  const changed = await changedFixtures();
  add('fixtures', {
    passed: changed.length ? 0 : 1,
    failed: changed.length ? 1 : 0,
    problems: changed.map((c) => `${c.path} changed (${c.was} → ${c.now}): restore it, or re-approve with --update-fixtures in a reviewed PR`),
  });
}

// browser layers
const browserLayers = ['responsive', 'specs', 'a11y', 'visual-figma'].filter((l) => level(l) !== 'off');
if (browserLayers.length) {
  const grep = `(${browserLayers.map((l) => `@${l} `).join('|')})${width ? `.* at ${width}px` : ''}`;
  const pw = spawnSync('npx', ['playwright', 'test', '-c', process.env.DESIGN_PW_CONFIG || 'test/design/playwright.config.js', '--grep', grep,
    ...(process.env.PLAYWRIGHT_ARGS ? process.env.PLAYWRIGHT_ARGS.split(' ') : [])], { stdio: 'inherit' });
  const out = process.env.DESIGN_RESULTS || 'test/design/design-results.json';
  if (!existsSync(out)) { console.error(`no results at ${out} (playwright exit ${pw.status})`); process.exit(2); }
  const report = JSON.parse(readFileSync(out, 'utf8'));
  browserLayers.forEach((l) => add(l, {}));
  const promoted = new Set(((config.layers['visual-figma'].promoted || {})[destination]) || []);
  const walk = (suite) => {
    (suite.specs || []).forEach((spec) => spec.tests.forEach((t) => {
      const layer = (spec.title.match(/^@([a-z0-9-]+) /) || [])[1];
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
  // a layer that ran nothing must not read as a pass (visual-figma skips until baselines exist)
  browserLayers.filter((l) => l !== 'visual-figma').forEach((l) => {
    const r = results[l];
    if (!r.passed && !r.failed) {
      r.failed = 1;
      r.problems.push('no tests ran for this layer: check the test titles and the --grep filter');
    }
  });
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
