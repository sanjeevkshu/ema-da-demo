#!/usr/bin/env node
/*
 * Folds the pr-quality jobs into the one required check, "Design (gate)".
 *   NEEDS='${{ toJSON(needs) }}' DESTINATION=develop node test/design/aggregate.mjs
 * A skipped job (nothing relevant changed) passes. A failed or cancelled job
 * fails the gate, except where gate.config.json keeps that layer at "report"
 * (the design shards already apply per-layer levels themselves).
 */
import { readFileSync, appendFileSync } from 'node:fs';

/** Pure decision, exported for test/design-gate.test.js. */
export function decide(needs, destination, config) {
  const reportOnly = { visual: config.layers.visual[destination] !== 'block' };
  const rows = Object.entries(needs).map(([job, { result }]) => {
    let verdict = 'pass';
    if (result === 'failure' || result === 'cancelled') verdict = reportOnly[job] ? 'report' : 'fail';
    return { job, result, verdict };
  });
  return { rows, ok: rows.every((r) => r.verdict !== 'fail') };
}

if (process.argv[1] && process.argv[1].endsWith('aggregate.mjs')) {
  const config = JSON.parse(readFileSync('reference/design/gate.config.json', 'utf8'));
  const destination = process.env.DESTINATION || 'develop';
  const { rows, ok } = decide(JSON.parse(process.env.NEEDS || '{}'), destination, config);
  const icon = { pass: '✅', report: '⚠️', fail: '❌' };
  const md = [`## Design (gate) — ${destination}: ${ok ? 'pass' : 'fail'}`, '', '| Job | Result | Verdict |', '|---|---|---|',
    ...rows.map((r) => `| ${r.job} | ${r.result} | ${icon[r.verdict]} ${r.verdict} |`)].join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  rows.filter((r) => r.verdict === 'report').forEach((r) => console.log(`::warning title=Design gate::${r.job} found differences (report-only at ${destination}); review them in its job or dashboard`));
  process.exit(ok ? 0 : 1);
}
