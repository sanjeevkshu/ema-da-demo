#!/usr/bin/env node
/*
 * npm run lint:actions [-- extra actionlint args]   (Build runs it on every push)
 * Lints .github/workflows with a pinned actionlint release. The binary is
 * downloaded once into node_modules/.cache/actionlint/<version>/ and verified
 * against its SHA-256 below; bump VERSION and SHA256 together (values from the
 * release's actionlint_<version>_checksums.txt). Set ACTIONLINT to use your own binary.
 * actionlint checks run: scripts with shellcheck only when it finds one, and GitHub's
 * runners have it while most laptops don't, so a pinned shellcheck is fetched the same
 * way and always passed in: local and CI lint the same. SHELLCHECK overrides it.
 */
/* eslint-disable no-console -- CLI: logs are the output */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
// repo root: this file lives in .github/scripts/
export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const VERSION = '1.7.12';
export const SHA256 = {
  darwin_amd64: '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644',
  darwin_arm64: 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f',
  linux_amd64: '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
  linux_arm64: '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6',
  windows_amd64: '6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9',
  windows_arm64: 'cadcf7ea4efe3a68728893813643cebe1185e5b1d4be5b96245f65c9a4d5ea41',
};

export const SHELLCHECK_VERSION = '0.10.0';
// sha256 of the release tarballs (koalaman/shellcheck publishes no checksum file)
export const SHELLCHECK_SHA256 = {
  'linux.x86_64': '6c881ab0698e4e6ea235245f22832860544f17ba386442fe7e9d629f8cbedf87',
  'linux.aarch64': '324a7e89de8fa2aed0d0c28f3dab59cf84c6d74264022c00c22af665ed1a09bb',
  'darwin.x86_64': 'ef27684f23279d112d8ad84e0823642e43f838993bbb8c0963db9b58a90464c2',
  'darwin.aarch64': 'bbd2f14826328eee7679da7221f2bc3afb011f6a928b848c80c321f6046ddf81',
};

/** "linux.x86_64"-style key for the shellcheck release, or null (e.g. Windows). */
export function shellcheckKey(platform = process.platform, arch = process.arch) {
  const os = { darwin: 'darwin', linux: 'linux' }[platform];
  const cpu = { x64: 'x86_64', arm64: 'aarch64' }[arch];
  return os && cpu ? `${os}.${cpu}` : null;
}

async function download(url, sha256) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sum = crypto.createHash('sha256').update(buf).digest('hex');
  if (sum !== sha256) throw new Error(`checksum mismatch for ${url}: ${sum}`);
  return buf;
}

async function installShellcheck(key) {
  const dir = path.join(ROOT, 'node_modules', '.cache', 'shellcheck', SHELLCHECK_VERSION);
  const bin = path.join(dir, `shellcheck-v${SHELLCHECK_VERSION}`, 'shellcheck');
  if (fs.existsSync(bin)) return bin;
  const name = `shellcheck-v${SHELLCHECK_VERSION}.${key}.tar.xz`;
  console.log(`downloading shellcheck ${SHELLCHECK_VERSION} (${key})`);
  const buf = await download(`https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/${name}`, SHELLCHECK_SHA256[key]);
  fs.mkdirSync(dir, { recursive: true });
  const archive = path.join(dir, name);
  fs.writeFileSync(archive, buf);
  execFileSync('tar', ['-xJf', archive, '-C', dir], { stdio: 'inherit' });
  fs.rmSync(archive);
  return bin;
}

export function platformKey(platform = process.platform, arch = process.arch) {
  const os = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[platform];
  const cpu = { x64: 'amd64', arm64: 'arm64' }[arch];
  const key = `${os}_${cpu}`;
  if (!os || !cpu || !SHA256[key]) throw new Error(`no pinned actionlint build for ${platform}/${arch}; set ACTIONLINT=/path/to/actionlint`);
  return key;
}

export function assetName(key, version = VERSION) {
  return `actionlint_${version}_${key}.${key.startsWith('windows') ? 'zip' : 'tar.gz'}`;
}

async function install(key) {
  const dir = path.join(ROOT, 'node_modules', '.cache', 'actionlint', VERSION);
  const bin = path.join(dir, key.startsWith('windows') ? 'actionlint.exe' : 'actionlint');
  if (fs.existsSync(bin)) return bin;
  const name = assetName(key);
  const url = `https://github.com/rhysd/actionlint/releases/download/v${VERSION}/${name}`;
  console.log(`downloading actionlint ${VERSION} (${key})`);
  const buf = await download(url, SHA256[key]);
  fs.mkdirSync(dir, { recursive: true });
  const archive = path.join(dir, name);
  fs.writeFileSync(archive, buf);
  // bsdtar (macOS, Windows 10+) also reads zip
  execFileSync('tar', ['-xf', archive, '-C', dir], { stdio: 'inherit' });
  fs.rmSync(archive);
  return bin;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const bin = process.env.ACTIONLINT || await install(platformKey());
    const scKey = shellcheckKey();
    const shellcheck = process.env.SHELLCHECK || (scKey ? await installShellcheck(scKey) : null);
    if (!shellcheck) console.warn('lint:actions: no pinned shellcheck for this platform; run: scripts are not checked (CI checks them)');
    const args = ['-color', ...(shellcheck ? ['-shellcheck', shellcheck] : []), ...process.argv.slice(2)];
    const { status } = spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' });
    process.exitCode = status === null ? 1 : status;
  } catch (e) {
    console.error(`lint:actions: ${e.message}`);
    process.exitCode = 1;
  }
}
