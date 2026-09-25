/*
 * Scripts behind .github/workflows/experience-audit.yaml: the report built from
 * Lighthouse results, and the wait for the live host to serve a push.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  badge, median, readLhrs, report, summarise,
  // eslint-disable-next-line import/extensions -- Node ESM script, not a browser module
} from '../.github/scripts/audit-summary.mjs';
import {
  isDeployed, servedFiles, waitForCode,
  // eslint-disable-next-line import/extensions -- Node ESM script, not a browser module
} from '../.github/scripts/wait-for-code.mjs';

const lhr = (url, perf, lcp) => ({
  requestedUrl: url,
  categories: {
    performance: { score: perf },
    accessibility: { score: 1 },
    'best-practices': { score: 0.96 },
    seo: { score: null },
  },
  audits: {
    'largest-contentful-paint': { numericValue: lcp },
    'cumulative-layout-shift': { numericValue: 0.012 },
    'total-blocking-time': { numericValue: 40.4 },
  },
});

describe('audit summary', () => {
  test('median handles odd, even, missing values', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
    assert.equal(median([null, undefined]), null);
  });

  test('badges follow Lighthouse colour bands', () => {
    assert.equal(badge(95), '🟢 95');
    assert.equal(badge(72), '🟠 72');
    assert.equal(badge(20), '🔴 20');
    assert.equal(badge(null), '–');
  });

  test('takes the median of runs per page and flags scores under 90', () => {
    const results = summarise([
      lhr('https://h/', 0.8, 2000), lhr('https://h/', 0.9, 3000), lhr('https://h/', 0.95, 2500),
      lhr('https://h/about', 0.99, 1000),
    ]);
    assert.equal(results.get('/').scores.performance, 90);
    assert.equal(results.get('/').metrics['largest-contentful-paint'], 2500);
    assert.equal(results.get('/').scores.seo, null);
    const types = [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' },
      { name: 'Shop', path: '/shop' },
    ];
    const { markdown, warnings } = report(types, results, 'mobile', { 'https://h/about': 'https://r/1' });
    assert.match(markdown, /### Experience audit: mobile/);
    assert.match(markdown, /median of 3 runs/);
    assert.match(markdown, /\| Home \| \/ \| 🟢 90 \| 🟢 100 \| 🟢 96 \| – \| 2\.5 s \| 0\.012 \| 40 ms \| – \|/);
    assert.match(markdown, /\[view\]\(https:\/\/r\/1\)/);
    assert.deepEqual(warnings, ['Shop (/shop): not audited']);
    const low = report([{ name: 'Home', path: '/' }], summarise([lhr('https://h/', 0.5, 9000)]), 'desktop');
    assert.deepEqual(low.warnings, ['Home (/) desktop: Perf 50 < 90']);
  });

  test('reads only lhr-*.json files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lhci-'));
    fs.writeFileSync(path.join(dir, 'lhr-1.json'), JSON.stringify(lhr('https://h/', 1, 1)));
    fs.writeFileSync(path.join(dir, 'links.json'), '{}');
    assert.equal(readLhrs(dir).length, 1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('page types list is well-formed', () => {
    const types = JSON.parse(fs.readFileSync('.github/page-types.json', 'utf8'));
    assert.ok(types.length > 0);
    types.forEach((t) => {
      assert.ok(t.name);
      assert.match(t.path, /^\/[a-z0-9-]*$/);
      assert.ok(t.pages.length > 0);
    });
    assert.equal(new Set(types.map((t) => t.path)).size, types.length);
  });
});

describe('wait for code', () => {
  const file = 'scripts/scripts.js';
  const body = fs.readFileSync(file, 'utf8');
  const respond = (text, ok = true) => async () => ({ ok, text: async () => text });

  test('only served code counts', () => {
    assert.deepEqual(servedFiles(['README.md', file, 'blocks/gone/gone.js', '.github/x.yaml']), [file]);
  });

  test('compares the live file with the pushed one', async () => {
    assert.equal(await isDeployed('https://h', file, respond(body)), true);
    assert.equal(await isDeployed('https://h', file, respond('old')), false);
    assert.equal(await isDeployed('https://h', file, respond(body, false)), false);
  });

  test('returns at once when nothing served changed', async () => {
    const logs = [];
    assert.equal(await waitForCode('https://h', ['README.md'], { log: (m) => logs.push(m) }), true);
    assert.match(logs[0], /nothing to wait for/);
  });

  test('polls until deployed, and warns on timeout', async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls === 1) throw new Error('network');
      return { ok: true, text: async () => body };
    };
    const logs = [];
    const opts = { intervalMs: 1, log: (m) => logs.push(m) };
    assert.equal(await waitForCode('https://h', [file], { ...opts, fetchImpl: flaky }), true);
    assert.equal(calls, 2);
    assert.match(logs.at(-1), /serves this push/);
    const stale = await waitForCode('https://h', [file], { ...opts, timeoutMs: 5, fetchImpl: respond('old') });
    assert.equal(stale, false);
    assert.match(logs.at(-1), /::warning .*still serves old code for scripts\/scripts\.js/);
  });
});
