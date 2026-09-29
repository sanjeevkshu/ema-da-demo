#!/usr/bin/env node
/*
 * Figma drift check, on demand. Fingerprints every mapped Figma frame (the
 * frame and its direct children: id, name, rounded size) and compares
 * with reference/design/figma-fingerprints.json. A changed fingerprint means
 * the designer edited that frame since the last sync; a missing node means it
 * was deleted or re-wrapped (as when 23:3 and 2:235 became sections).
 *
 * Two sources, same fingerprint:
 *   FIGMA_TOKEN=… node test/design/drift.mjs              Figma REST API (the "Design drift" workflow)
 *   node test/design/drift.mjs --from-metadata <dir>       Figma MCP get_metadata (maxDepth 1) XML saved as <dir>/<id>.xml,
 *                                                          one per node (id with ":" as "-"); used from the workspace
 * Options: --write (store the new fingerprints after a reviewed sync)
 *          --fail-on-drift (exit 1 when a frame changed)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const sync = JSON.parse(readFileSync('reference/figma-sync.json', 'utf8'));
const plan = JSON.parse(readFileSync('reference/migration-plan.json', 'utf8'));
const STORE = 'reference/design/figma-fingerprints.json';

/** Every Figma frame the site is built from: pages, their tablet/phone frames, token sources. */
export function mappedNodes() {
  const nodes = new Map();
  Object.entries(sync.pages).forEach(([slug, p]) => { if (!nodes.has(p.sourceNode)) nodes.set(p.sourceNode, `page ${slug}`); });
  plan.pages.forEach((p) => {
    if (p.tabletNodeId) nodes.set(p.tabletNodeId, `page ${p.slug} (tablet)`);
    if (p.mobileNodeId) nodes.set(p.mobileNodeId, `page ${p.slug} (phone)`);
  });
  Object.entries(sync.blocks).forEach(([b, v]) => (v.responsiveNodes || []).forEach((n) => { if (!nodes.has(n)) nodes.set(n, `block ${b} (responsive)`); }));
  sync.tokens.sourceNodes.forEach((n) => { if (!nodes.has(n)) nodes.set(n, 'design tokens'); });
  return nodes;
}

/** Fingerprint from a node and its children: [{ id, type, name, w, h }]. */
export function fingerprint(items) {
  // type is left out: the REST API and the MCP server name some node types differently
  const lines = items.map((n) => `${n.id}|${n.name}|${Math.round(n.w)}|${Math.round(n.h)}`);
  return { hash: createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 12), size: `${Math.round(items[0].w)}x${Math.round(items[0].h)}`, children: items.length - 1 };
}

/** Items from MCP get_metadata XML (maxDepth 1). */
export function itemsFromXml(xml) {
  const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return [...xml.matchAll(/<(\w+) id="([^"]+)" name="([^"]*)"[^>]*? width="([\d.]+)" height="([\d.]+)"/g)]
    .map(([, type, id, name, w, h]) => ({
      id, type, name: decode(name), w: Number(w), h: Number(h),
    }));
}

/** Items from a Figma REST node document (depth 1). */
export function itemsFromRest(doc) {
  const one = (n) => ({
    id: n.id, type: n.type, name: n.name, w: (n.absoluteBoundingBox || {}).width || 0, h: (n.absoluteBoundingBox || {}).height || 0,
  });
  return [one(doc), ...(doc.children || []).map(one)];
}

async function fromRest(ids) {
  const token = process.env.FIGMA_TOKEN;
  const api = (path) => fetch(`https://api.figma.com/v1/files/${sync.fileKey}${path}`, { headers: { 'X-Figma-Token': token } })
    .then((r) => { if (!r.ok) throw new Error(`Figma API ${r.status} on ${path}`); return r.json(); });
  const meta = await api('?depth=1');
  const res = await api(`/nodes?depth=1&ids=${encodeURIComponent(ids.join(','))}`);
  const out = {};
  ids.forEach((id) => { const n = res.nodes[id]; out[id] = n && n.document ? fingerprint(itemsFromRest(n.document)) : null; });
  return { out, meta: { version: meta.version, lastModified: meta.lastModified } };
}

function fromXml(dir) {
  const out = {};
  mappedNodes().forEach((_, id) => {
    const f = join(dir, `${id.replace(':', '-')}.xml`);
    if (!existsSync(f)) { out[id] = undefined; return; }
    const xml = readFileSync(f, 'utf8');
    out[id] = /not found/i.test(xml) ? null : fingerprint(itemsFromXml(xml));
  });
  return { out, meta: { source: 'figma mcp get_metadata' } };
}

async function main() {
  const nodes = mappedNodes();
  const ids = [...nodes.keys()];
  let result;
  if (opt('--from-metadata')) result = fromXml(opt('--from-metadata'));
  else if (process.env.FIGMA_TOKEN) result = await fromRest(ids);
  else {
    console.log('::notice title=Design drift::No FIGMA_TOKEN secret, so the drift check is dormant. Add one under Settings → Secrets → Actions, or ask the agent to "check Figma drift".');
    return 0;
  }
  const stored = existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')).nodes : {};
  const rows = ids.map((id) => {
    const now = result.out[id];
    const was = stored[id];
    let state = 'same';
    if (now === undefined) state = 'not checked';
    else if (now === null) state = 'MISSING in Figma';
    else if (!was) state = 'new (no fingerprint yet)';
    else if (was.hash !== now.hash) state = `CHANGED (${was.size}, ${was.children} children → ${now.size}, ${now.children})`;
    return { id, what: nodes.get(id), state };
  });
  const drift = rows.filter((r) => /MISSING|CHANGED/.test(r.state));
  const md = [`## Figma drift — ${drift.length ? `${drift.length} frame(s) changed` : 'no drift'}`, '',
    `File ${sync.fileKey}; last sync ${sync.lastSynced}; ${JSON.stringify(result.meta)}`, '',
    '| Node | Used for | State |', '|---|---|---|', ...rows.map((r) => `| ${r.id} | ${r.what} | ${r.state} |`),
    '', drift.length ? 'Next: review each changed frame against its blocks (reference/figma-sync.json), update the build or the specs, then store the new fingerprints with --write in the same PR.' : ''].join('\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`, { flag: 'a' });

  if (args.includes('--write')) {
    const keep = Object.fromEntries(Object.entries(result.out).filter(([, v]) => v));
    writeFileSync(STORE, `${JSON.stringify({ $comment: 'Figma frame fingerprints at the last reviewed sync. Written by test/design/drift.mjs --write.', verified: new Date().toISOString().slice(0, 10), nodes: keep }, null, 2)}\n`);
    console.log(`stored ${Object.keys(keep).length} fingerprints`);
  }
  return drift.length && args.includes('--fail-on-drift') ? 1 : 0;
}

if (process.argv[1] && process.argv[1].endsWith('drift.mjs')) main().then((code) => process.exit(code));
