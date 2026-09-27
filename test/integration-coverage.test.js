/*
 * Integration coverage gate (unit level). Every file that talks to another
 * system must be listed in test/integration/coverage.json with a spec that
 * exists, so a new integration can't ship without an integration check.
 * The specs themselves run in CI (.github/workflows/integration.yaml).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(fs.readFileSync('test/integration/coverage.json', 'utf8'));
const entries = Object.entries(manifest.integrations);
const covered = new Set(entries.flatMap(([, i]) => i.code));

// Files that are integrations by nature: every script except the vendored core,
// and every Config Service copy.
const CORE_SCRIPTS = new Set(['scripts/aem.js', 'scripts/scripts.js']);
const mustBeCovered = [
  ...fs.readdirSync('scripts').map((f) => `scripts/${f}`).filter((f) => !CORE_SCRIPTS.has(f)),
  ...fs.readdirSync('reference/site-config').map((f) => `reference/site-config/${f}`),
];

describe('integration coverage', () => {
  test('every integration file is mapped to an integration check', () => {
    assert.deepEqual(mustBeCovered.filter((f) => !covered.has(f)), []);
  });

  test('every mapped file and spec exists', () => {
    entries.forEach(([name, { code, spec }]) => {
      code.forEach((f) => assert.ok(fs.existsSync(f), `${name}: ${f} is missing`));
      assert.ok(fs.existsSync(path.join('test/integration', spec)), `${name}: ${spec} is missing`);
    });
  });

  test('every spec is claimed by an integration', () => {
    const specs = fs.readdirSync('test/integration').filter((f) => f.endsWith('.spec.js'));
    const claimed = new Set(entries.map(([, i]) => i.spec));
    assert.deepEqual(specs.filter((s) => !claimed.has(s)), []);
  });
});
