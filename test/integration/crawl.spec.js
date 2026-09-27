/*
 * Crawl rules (reference/site-config/robots.txt, sitemap.yaml): the production
 * domain admits Adobe's crawlers only; *.aem.live stays out of search engines.
 */
import { test, expect } from '@playwright/test';
import { LIVE_URL, PROD_URL } from './helpers.js';

/** robots.txt groups as { agent: [rules] } (RFC 9309, lower-cased agents). */
function parseRobots(text) {
  const groups = {};
  let agents = [];
  let inRules = false;
  text.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean).forEach((line) => {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(key)) {
      if (inRules) { agents = []; inRules = false; }
      agents.push(value.toLowerCase());
      agents.forEach((a) => { groups[a] = groups[a] || []; });
    } else if (/^(allow|disallow)$/i.test(key)) {
      inRules = true;
      agents.forEach((a) => groups[a].push(`${key.toLowerCase()}:${value}`));
    }
  });
  return groups;
}

test('production robots.txt admits AdobeAgentComposer and Spacecat, blocks everyone else', async ({ request }) => {
  const res = await request.get(`${PROD_URL}/robots.txt`);
  expect(res.status()).toBe(200);
  const text = await res.text();
  const groups = parseRobots(text);
  expect(groups.adobeagentcomposer, 'Brand Concierge crawler').toEqual(['allow:/']);
  expect(groups.spacecat).toEqual(['allow:/']);
  expect(groups['*'], 'public crawlers until launch').toEqual(['disallow:/']);
  expect(text).toContain(`Sitemap: ${PROD_URL}/sitemap.xml`);
});

test('production sitemap lists only production URLs, and every published page', async ({ request }) => {
  const sitemap = await (await request.get(`${PROD_URL}/sitemap.xml`)).text();
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThanOrEqual(18);
  locs.forEach((l) => expect(l.startsWith(`${PROD_URL}/`)).toBe(true));
  const index = await (await request.get(`${PROD_URL}/query-index.json`)).json();
  const indexable = index.data.filter((r) => !/noindex/i.test(r.robots || '')).map((r) => `${PROD_URL}${r.path}`);
  expect(locs.sort()).toEqual(indexable.sort());
});

test('production pages carry the production canonical and no noindex header', async ({ request }) => {
  const res = await request.get(`${PROD_URL}/pulse-loop`);
  expect(res.headers()['x-robots-tag']).toBeUndefined();
  expect(await res.text()).toContain(`<link rel="canonical" href="${PROD_URL}/pulse-loop">`);
});

test('*.aem.live stays blocked for every crawler', async ({ request }) => {
  const robots = parseRobots(await (await request.get(`${LIVE_URL}/robots.txt`)).text());
  expect(robots['*']).toEqual(['disallow:/']);
  const page = await request.get(`${LIVE_URL}/pulse-loop`);
  expect(page.headers()['x-robots-tag']).toMatch(/noindex/);
});
