#!/usr/bin/env node
/*
 * Turns Lighthouse CI results into the experience-audit report: one row per
 * page type (.github/page-types.json) with median category scores and Core Web
 * Vitals lab metrics, plus a ::warning:: annotation for every score under 90.
 * Report-only: always exits 0.
 *
 * Usage: node audit-summary.mjs <lhci-dir> <form-factor> [page-types.json]
 * Appends markdown to $GITHUB_STEP_SUMMARY when set, else prints it.
 */
/* eslint-disable no-console -- CI script: logs are the output */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CATEGORIES = [
  ['performance', 'Perf'],
  ['accessibility', 'A11y'],
  ['best-practices', 'Best practices'],
  ['seo', 'SEO'],
];
export const METRICS = [
  ['largest-contentful-paint', 'LCP', (v) => `${(v / 1000).toFixed(1)} s`],
  ['cumulative-layout-shift', 'CLS', (v) => v.toFixed(3)],
  ['total-blocking-time', 'TBT', (v) => `${Math.round(v)} ms`],
];
export const THRESHOLD = 90;

export function median(values) {
  const sorted = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median scores (0-100) and metrics for each audited URL path. */
export function summarise(lhrs) {
  const byPath = new Map();
  lhrs.forEach((lhr) => {
    const p = new URL(lhr.requestedUrl).pathname;
    if (!byPath.has(p)) byPath.set(p, []);
    byPath.get(p).push(lhr);
  });
  const result = new Map();
  byPath.forEach((runs, p) => {
    const scores = {};
    CATEGORIES.forEach(([id]) => {
      const m = median(runs.map((r) => r.categories[id] && r.categories[id].score));
      scores[id] = m === null ? null : Math.round(m * 100);
    });
    const metrics = {};
    METRICS.forEach(([id]) => {
      metrics[id] = median(runs.map((r) => r.audits[id] && r.audits[id].numericValue));
    });
    result.set(p, { scores, metrics, runs: runs.length });
  });
  return result;
}

export function badge(score) {
  if (score === null) return '–';
  if (score >= THRESHOLD) return `🟢 ${score}`;
  if (score >= 50) return `🟠 ${score}`;
  return `🔴 ${score}`;
}

export function report(pageTypes, results, formFactor, links = {}) {
  const warnings = [];
  const head = ['Page type', 'Page', ...CATEGORIES.map(([, l]) => l), ...METRICS.map(([, l]) => l), 'Report'];
  const rows = pageTypes.map((t) => {
    const r = results.get(t.path);
    if (!r) {
      warnings.push(`${t.name} (${t.path}): not audited`);
      return [t.name, t.path, ...head.slice(2).map(() => '–')];
    }
    CATEGORIES.forEach(([id, label]) => {
      if (r.scores[id] !== null && r.scores[id] < THRESHOLD) {
        warnings.push(`${t.name} (${t.path}) ${formFactor}: ${label} ${r.scores[id]} < ${THRESHOLD}`);
      }
    });
    const link = Object.entries(links).find(([u]) => new URL(u).pathname === t.path);
    return [
      t.name,
      t.path,
      ...CATEGORIES.map(([id]) => badge(r.scores[id])),
      ...METRICS.map(([id, , fmt]) => (r.metrics[id] === null ? '–' : fmt(r.metrics[id]))),
      link ? `[view](${link[1]})` : '–',
    ];
  });
  const line = (cells) => `| ${cells.join(' | ')} |`;
  const markdown = [
    `### Experience audit: ${formFactor}`,
    '',
    `One page per page type, median of ${Math.max(...[...results.values()].map((r) => r.runs), 0)} runs.`
      + ` Report only: scores under ${THRESHOLD} are flagged, never fail the build.`
      + ' SEO skips `is-crawlable`: *.aem.live is noindex by design; production is not.',
    '',
    line(head),
    line(head.map(() => '---')),
    ...rows.map(line),
    '',
  ].join('\n');
  return { markdown, warnings };
}

export function readLhrs(dir) {
  return fs.readdirSync(dir)
    .filter((f) => /^lhr-.*\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function main() {
  const [dir = '.lighthouseci', formFactor = 'mobile', typesFile = '.github/page-types.json'] = process.argv.slice(2);
  const pageTypes = JSON.parse(fs.readFileSync(typesFile, 'utf8'));
  const lhrs = fs.existsSync(dir) ? readLhrs(dir) : [];
  const linksFile = path.join(dir, 'links.json');
  const links = fs.existsSync(linksFile) ? JSON.parse(fs.readFileSync(linksFile, 'utf8')) : {};
  const { markdown, warnings } = report(pageTypes, summarise(lhrs), formFactor, links);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  else console.log(markdown);
  warnings.forEach((w) => console.log(`::warning title=Experience audit::${w}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
