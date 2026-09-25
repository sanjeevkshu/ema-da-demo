#!/usr/bin/env node
/*
 * Waits until the live host serves the code from this push, so the audit
 * measures the new code rather than the previous deploy. Compares each changed
 * served file (blocks/, scripts/, styles/) with the host. Never fails: after
 * the timeout it warns and lets the audit run anyway.
 *
 * Usage: node wait-for-code.mjs <host> [file ...]
 */
/* eslint-disable no-console -- CI script: logs are the output */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SERVED = /^(blocks|scripts|styles)\/.+\.(js|css)$/;

export function servedFiles(files) {
  return files.filter((f) => SERVED.test(f) && fs.existsSync(f));
}

export async function isDeployed(host, file, fetchImpl = fetch) {
  const res = await fetchImpl(`${host}/${file}?ck=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return false;
  return (await res.text()) === fs.readFileSync(file, 'utf8');
}

export async function waitForCode(host, files, {
  timeoutMs = 300000, intervalMs = 10000, fetchImpl = fetch, log = console.log,
} = {}) {
  let pending = servedFiles(files);
  if (!pending.length) {
    log('No served code changed; nothing to wait for.');
    return true;
  }
  const start = Date.now();
  for (;;) {
    const check = (f) => isDeployed(host, f, fetchImpl).catch(() => false);
    // eslint-disable-next-line no-await-in-loop
    const checks = await Promise.all(pending.map(check));
    pending = pending.filter((f, i) => !checks[i]);
    if (!pending.length) {
      log(`Live host serves this push (${Math.round((Date.now() - start) / 1000)}s).`);
      return true;
    }
    if (Date.now() - start >= timeoutMs) {
      log(`::warning title=Experience audit::Live host still serves old code for ${pending.join(', ')}; auditing anyway.`);
      return false;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, intervalMs); });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [host, ...files] = process.argv.slice(2);
  await waitForCode(host, files);
}
