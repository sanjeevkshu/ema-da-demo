/* .github/scripts/actionlint.mjs: pinned actionlint + shellcheck behind npm run lint:actions. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  platformKey, assetName, SHA256, VERSION, shellcheckKey, SHELLCHECK_SHA256, SHELLCHECK_VERSION,
  // eslint-disable-next-line import/extensions -- Node ESM script, not a browser module
} from '../.github/scripts/actionlint.mjs';

describe('actionlint pin', () => {
  test('every pinned build has a checksum and an asset name', () => {
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
    Object.entries(SHA256).forEach(([k, sum]) => {
      assert.match(sum, /^[0-9a-f]{64}$/, k);
      assert.match(assetName(k), new RegExp(`^actionlint_${VERSION}_${k}\\.(tar\\.gz|zip)$`));
    });
    assert.equal(platformKey('linux', 'x64'), 'linux_amd64');
    assert.equal(platformKey('darwin', 'arm64'), 'darwin_arm64');
    assert.throws(() => platformKey('aix', 'ppc64'), /ACTIONLINT=/);
  });

  test('shellcheck is pinned for every platform it maps, so local lint matches CI', () => {
    assert.equal(shellcheckKey('linux', 'x64'), 'linux.x86_64');
    assert.equal(shellcheckKey('darwin', 'arm64'), 'darwin.aarch64');
    assert.equal(shellcheckKey('win32', 'x64'), null, 'Windows lints without it and says so');
    ['linux', 'darwin'].forEach((os) => ['x64', 'arm64'].forEach((cpu) => {
      assert.match(SHELLCHECK_SHA256[shellcheckKey(os, cpu)], /^[0-9a-f]{64}$/, `${os}/${cpu}`);
    }));
    assert.match(SHELLCHECK_VERSION, /^\d+\.\d+\.\d+$/);
  });
});
