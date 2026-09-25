import {
  test, describe, beforeEach,
} from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.js';

installDom();
window.hlx = { codeBasePath: '' };

const {
  default: init, ALLOY_URL, CONFIG, OPT_OUT, WEB_CLIENT_URL, environment, installAlloyStub,
  isSurface, mountLauncher, resolveConfig, startConcierge,
} = await import('../scripts/brand-concierge.js');

const configured = {
  ...CONFIG, orgId: 'ORG@AdobeOrg', datastreams: { dev: 'ds-dev', stage: 'ds-stage', prod: 'ds-prod' },
};
const at = (url) => new URL(url);
const flush = () => new Promise((r) => { setTimeout(r, 0); });

function fakeWindow() {
  const calls = [];
  const listeners = {};
  const win = {
    hlx: { codeBasePath: '' },
    location: at('https://main--x--y.aem.live/pulse-loop'),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    adobe: { concierge: { bootstrap: (opts) => calls.push(['bootstrap', opts]) } },
  };
  const load = async (src) => {
    calls.push(['load', src]);
    if (src === ALLOY_URL) win.alloy = (...args) => { calls.push(['alloy', ...args]); };
  };
  return {
    win, load, calls, listeners,
  };
}

describe('brand concierge: settings', () => {
  test('maps hosts to environments', () => {
    assert.equal(environment('localhost'), 'dev');
    assert.equal(environment('feat-x--ema-da-demo--sanjeevkshu.aem.page'), 'dev');
    assert.equal(environment('main--ema-da-demo--sanjeevkshu.aem.live'), 'stage');
    assert.equal(environment('www.pulse.example'), 'prod');
  });

  test('matches surface paths exactly or by prefix', () => {
    const paths = ['/', '/discover', '/pulse-*'];
    assert.ok(isSurface('/', paths));
    assert.ok(isSurface('/discover/', paths));
    assert.ok(isSurface('/pulse-loop.html', paths));
    assert.equal(isSurface('/contact', paths), false);
    assert.equal(isSurface('/search', paths), false);
  });

  test('stays off until IDs are set, off-surface, or with ?concierge=off', () => {
    assert.equal(resolveConfig(at('https://main--x--y.aem.live/'), CONFIG), null, 'shipped without IDs');
    assert.equal(resolveConfig(at('https://main--x--y.aem.live/contact'), configured), null);
    assert.equal(resolveConfig(at('https://main--x--y.aem.live/?concierge=off'), configured), null);
    const noProd = { ...configured, datastreams: { ...configured.datastreams, prod: '' } };
    assert.equal(resolveConfig(at('https://www.pulse.example/'), noProd), null);
  });

  test('picks the datastream for the environment; debug only on request', () => {
    const live = resolveConfig(at('https://main--x--y.aem.live/pulse-loop'), configured);
    assert.equal(live.datastreamId, 'ds-stage');
    assert.equal(live.env, 'stage');
    assert.equal(live.debug, false);
    const preview = resolveConfig(at('https://b--x--y.aem.page/?concierge=debug'), configured);
    assert.equal(preview.datastreamId, 'ds-dev');
    assert.equal(preview.debug, true);
  });

  test('the shipped surface list leaves out search and contact', () => {
    assert.equal(isSurface('/search', CONFIG.paths), false);
    assert.equal(isSurface('/contact', CONFIG.paths), false);
    assert.ok(isSurface('/pulse-vision-ar', CONFIG.paths));
  });
});

describe('brand concierge: Web SDK', () => {
  test('the base code queues calls until the SDK loads, and is installed once', async () => {
    const win = {};
    installAlloyStub(win);
    // eslint-disable-next-line no-underscore-dangle
    assert.deepEqual(win.__alloyNS, ['alloy']);
    const pending = win.alloy('configure', { a: 1 });
    assert.equal(win.alloy.q.length, 1);
    assert.deepEqual(win.alloy.q[0][2], ['configure', { a: 1 }]);
    win.alloy.q[0][0]('ok');
    assert.equal(await pending, 'ok');
    const first = win.alloy;
    installAlloyStub(win);
    assert.equal(win.alloy, first);
  });

  test('loads the SDK, configures it, then boots the Web Client with the styles', async () => {
    const {
      win, load, calls, listeners,
    } = fakeWindow();
    const cfg = resolveConfig(at('https://main--x--y.aem.live/pulse-loop'), configured);
    const fetchImpl = async (url) => ({ ok: url.endsWith('/scripts/brand-concierge-styles.json'), json: async () => ({ theme: 1 }) });
    await startConcierge(cfg, '#mount', { win, load, fetchImpl });
    assert.deepEqual(calls.filter(([k]) => k === 'load').map(([, s]) => s), [ALLOY_URL, WEB_CLIENT_URL]);
    const [, , options] = calls.find(([k, cmd]) => k === 'alloy' && cmd === 'configure');
    assert.equal(options.datastreamId, 'ds-stage');
    assert.equal(options.orgId, 'ORG@AdobeOrg');
    assert.equal(options.debugEnabled, false);
    assert.equal(options.thirdPartyCookiesEnabled, false);
    assert.deepEqual(options.conversation, { region: 'va7' });
    const xdm = { web: { webPageDetails: {} } };
    assert.equal(options.onBeforeEventSend({ xdm }), true);
    assert.equal(xdm.web.webPageDetails.name, '/pulse-loop');
    assert.equal(options.onBeforeEventSend({ xdm: {} }), true);
    assert.ok(calls.some(([k, cmd]) => k === 'alloy' && cmd === 'sendEvent'));
    const [, boot] = calls.find(([k]) => k === 'bootstrap');
    assert.deepEqual(boot, {
      instanceName: 'alloy', stylingConfigurations: { theme: 1 }, selector: '#mount', stickySession: false,
    });

    listeners['consent.update']({ detail: { consented: true } });
    assert.equal(calls.filter(([, cmd]) => cmd === 'setConsent').length, 0);
    listeners['consent.update']({ detail: { consented: false } });
    assert.deepEqual(calls.find(([, cmd]) => cmd === 'setConsent'), ['alloy', 'setConsent', OPT_OUT]);
    listeners['consent.update']({});
  });

  test('boots with empty styles when the styles file is missing or unreachable', async () => {
    const failures = [async () => ({ ok: false }), async () => { throw new Error('offline'); }];
    await Promise.all(failures.map(async (fetchImpl) => {
      const { win, load, calls } = fakeWindow();
      await startConcierge({ ...configured, datastreamId: 'd' }, '#m', { win, load, fetchImpl });
      assert.deepEqual(calls.find(([k]) => k === 'bootstrap')[1].stylingConfigurations, {});
    }));
  });
});

describe('brand concierge: launcher', () => {
  beforeEach(() => {
    installDom();
    window.hlx = { codeBasePath: '' };
    // jsdom lacks the non-modal dialog methods
    window.HTMLDialogElement.prototype.show = function show() { this.open = true; };
    window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  });

  test('adds a labelled launcher and a closed panel with the mount point', () => {
    const { launcher, panel } = mountLauncher(configured, { start: async () => {} });
    assert.equal(launcher.textContent, 'Ask PULSE');
    assert.equal(launcher.getAttribute('aria-controls'), 'concierge-panel');
    assert.equal(launcher.getAttribute('aria-expanded'), 'false');
    assert.equal(panel.tagName, 'DIALOG');
    assert.equal(panel.getAttribute('aria-label'), 'Ask PULSE');
    assert.equal(panel.open, false);
    assert.ok(panel.querySelector('#brand-concierge-mount'));
  });

  test('loads the SDKs on the first open only; Escape and close return focus', async () => {
    const starts = [];
    const { launcher, panel } = mountLauncher(configured, {
      start: async (cfg, selector) => { starts.push(selector); },
    });
    launcher.click();
    assert.equal(panel.open, true);
    assert.equal(launcher.getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, panel.querySelector('.concierge-close'));
    assert.deepEqual(starts, ['#brand-concierge-mount']);

    panel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'a' }));
    assert.equal(panel.open, true);
    panel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    assert.equal(panel.open, false);
    assert.equal(document.activeElement, launcher);

    launcher.click();
    panel.querySelector('.concierge-close').click();
    assert.equal(panel.open, false);
    launcher.click();
    launcher.click();
    assert.equal(panel.open, false, 'the launcher toggles');
    assert.equal(starts.length, 1, 'SDKs load once');
  });

  /* eslint-disable no-console -- the block logs load failures; capture them */
  test('a failed load is logged and retried on the next open', async () => {
    let attempts = 0;
    const errors = [];
    const original = console.error;
    console.error = (...args) => errors.push(args);
    const { launcher } = mountLauncher(configured, {
      start: async () => { attempts += 1; throw new Error('blocked'); },
    });
    launcher.click();
    await flush();
    launcher.click();
    launcher.click();
    await flush();
    console.error = original;
    assert.equal(attempts, 2);
    assert.equal(errors.length, 2);
  });
  /* eslint-enable no-console */

  test('init does nothing while the IDs are unset', () => {
    assert.equal(init(), null);
    assert.equal(document.querySelector('.concierge-launcher'), null);
  });
});
