import {
  test, describe, beforeEach,
} from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.js';

installDom();
window.hlx = { codeBasePath: '' };

const {
  default: init, ALLOY_URL, CONFIG, OPT_IN, OPT_OUT, WEB_CLIENT_URL, environment, installAlloyStub,
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
    assert.equal(environment('pulse-portal-ivory.vercel.app'), 'prod', 'the production domain');
  });

  test('matches surface paths exactly or by prefix', () => {
    const paths = ['/', '/discover', '/pulse-*'];
    assert.ok(isSurface('/', paths));
    assert.ok(isSurface('/discover/', paths));
    assert.ok(isSurface('/pulse-loop.html', paths));
    assert.equal(isSurface('/contact', paths), false);
    assert.equal(isSurface('/search', paths), false);
  });

  test('stays off without IDs, off-surface, or with ?concierge=off', () => {
    const unset = { ...CONFIG, orgId: '', datastreams: { dev: '', stage: '', prod: '' } };
    assert.equal(resolveConfig(at('https://main--x--y.aem.live/'), unset), null, 'no IDs');
    assert.equal(resolveConfig(at('https://main--x--y.aem.live/'), { ...configured, orgId: '' }), null);
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

  test('the shipped config is set for every environment', () => {
    assert.match(CONFIG.orgId, /^[0-9A-F]{24}@AdobeOrg$/);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    Object.values(CONFIG.datastreams).forEach((id) => assert.match(id, uuid));
    assert.equal(CONFIG.region, 'va7');
    const live = resolveConfig(at('https://main--ema-da-demo--sanjeevkshu.aem.live/pulse-loop'), CONFIG);
    assert.equal(live.env, 'stage');
    assert.equal(resolveConfig(at('https://pulse-portal-ivory.vercel.app/pulse-loop'), CONFIG).env, 'prod');
  });

  test('the shipped surface list leaves out search and contact', () => {
    assert.equal(isSurface('/search', CONFIG.paths), false);
    assert.equal(isSurface('/contact', CONFIG.paths), false);
    assert.ok(isSurface('/pulse-vision-ar', CONFIG.paths));
  });
});

describe('brand concierge: styling config', () => {
  // The Web Client fails with "Unexpected error during rendering / No chat
  // history element found in container" when any of these strings is missing
  // (found on the branch preview, 2026-09-27). Keep them in the Composer export.
  const REQUIRED_TEXT = [
    'welcome.heading', 'welcome.subheading', 'input.placeholder', 'input.messageInput.aria',
    'input.send.aria', 'input.aiChatIcon.tooltip', 'input.mic.aria', 'card.aria.select',
    'carousel.prev.aria', 'carousel.next.aria', 'scroll.bottom.aria', 'error.network',
    'loading.message', 'feedback.dialog.title.positive', 'feedback.dialog.title.negative',
    'feedback.dialog.question.positive', 'feedback.dialog.question.negative',
    'feedback.dialog.notes', 'feedback.dialog.submit', 'feedback.dialog.cancel',
    'feedback.dialog.notes.placeholder', 'feedback.toast.success', 'feedback.thumbsUp.aria',
    'feedback.thumbsDown.aria', 'feedback.title', 'feedback.positive.title',
    'feedback.negative.title', 'feedback.submitButton', 'feedback.positive.options',
    'feedback.negative.options',
  ];

  test('has every text string the Web Client needs to render', async () => {
    const fs = await import('node:fs');
    const styles = JSON.parse(fs.readFileSync('scripts/brand-concierge-styles.json', 'utf8'));
    const missing = REQUIRED_TEXT.filter((key) => !(key in styles.text));
    assert.deepEqual(missing, []);
    assert.ok(styles.metadata && styles.theme && styles.arrays['welcome.examples'].length > 0);
  });

  test('theme uses only variables the Web Client supports', async () => {
    const fs = await import('node:fs');
    const { theme } = JSON.parse(fs.readFileSync('scripts/brand-concierge-styles.json', 'utf8'));
    const { variables } = JSON.parse(fs.readFileSync('reference/brand-concierge/supported-theme-variables.json', 'utf8'));
    assert.deepEqual(Object.keys(theme).filter((key) => !variables.includes(key)), []);
  });

  // WCAG 2.2 AA: 4.5:1 for text, 3:1 for input borders and focus rings
  test('theme colour pairs meet WCAG AA contrast', async () => {
    const fs = await import('node:fs');
    const { theme } = JSON.parse(fs.readFileSync('scripts/brand-concierge-styles.json', 'utf8'));
    const luminance = (hex) => {
      const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map((c) => {
        const v = parseInt(c, 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const t = (key) => theme[key];
    const pairs = [
      ['--color-text', '--main-container-background', 4.5],
      ['--color-text-muted', '--main-container-background', 4.5],
      ['--welcome-subheading-text-color', '--main-container-background', 4.5],
      ['--message-concierge-text', '--message-concierge-background', 4.5],
      ['--message-concierge-link-color', '--message-concierge-background', 4.5],
      ['--message-user-text', '--message-user-background', 4.5],
      ['--input-text-color', '--input-background', 4.5],
      ['--input-outline-color', '--input-background', 3],
      ['--input-focus-outline-color', '--input-background', 3],
      ['--submit-button-fill-color', '--color-button-submit', 3],
      ['--prompt-suggestion-button-text-color', '--prompt-suggestion-button-background', 4.5],
      ['--prompt-suggestion-button-text-color', '--prompt-suggestion-button-background-hover', 4.5],
      ['--prompt-pill-text-color', '--prompt-pill-background', 4.5],
      ['--button-primary-text', '--button-primary-background', 4.5],
      ['--button-primary-text', '--button-primary-hover', 4.5],
      ['--card-text-color', '--card-background', 4.5],
      ['--disclaimer-color', '--main-container-background', 4.5],
      ['--privacy-notice-text-color', '--privacy-notice-background', 4.5],
      ['--privacy-notice-title-color', '--privacy-notice-background', 4.5],
    ];
    const failing = pairs
      .map(([fg, bg, min]) => [fg, bg, min, ratio(t(fg), t(bg))])
      .filter(([, , min, r]) => r < min)
      .map(([fg, bg, min, r]) => `${fg} on ${bg}: ${r.toFixed(2)} < ${min}`);
    assert.deepEqual(failing, []);
  });

  test('inputs are at least 16px (no iOS zoom) and touch targets at least 40px', async () => {
    const fs = await import('node:fs');
    const { theme } = JSON.parse(fs.readFileSync('scripts/brand-concierge-styles.json', 'utf8'));
    const px = (v) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));
    assert.ok(px(theme['--input-font-size']) >= 16);
    ['--input-height', '--input-height-mobile'].forEach((k) => assert.ok(px(theme[k]) >= 44, k));
    ['--input-button-height', '--input-button-width', '--button-height-s', '--feedback-icon-btn-size-desktop']
      .forEach((k) => assert.ok(px(theme[k]) >= 40, k));
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

  test('a rejected Web SDK command is swallowed, not left unhandled', async () => {
    const { win, load } = fakeWindow();
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    const failingLoad = async (src) => {
      await load(src);
      if (src === ALLOY_URL) win.alloy = async () => { throw new Error('400 from edge'); };
    };
    const listeners = {};
    win.addEventListener = (type, fn) => { listeners[type] = fn; };
    await startConcierge({ ...configured, datastreamId: 'd' }, '#m', { win, load: failingLoad, fetchImpl: async () => ({ ok: false }) });
    listeners['consent.update']({ detail: { consented: false } });
    await flush();
    process.off('unhandledRejection', onUnhandled);
    assert.deepEqual(unhandled, []);
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
    // the Web Client's chat history covers anything inside the mount, so the
    // close button must live in the header bar, outside it
    const close = panel.querySelector('.concierge-close');
    assert.equal(close.closest('#brand-concierge-mount'), null);
    assert.equal(close.closest('.concierge-header').querySelector('.concierge-title').textContent, 'Ask PULSE');
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

  test('init mounts the launcher and its styles on a surface page', () => {
    const { launcher } = init();
    assert.equal(document.querySelector('.concierge-launcher'), launcher);
    assert.ok(document.querySelector('link[href$="/styles/brand-concierge.css"]'));
  });

  test('withdrawing consent removes the assistant; accepting again restores it', () => {
    init();
    const consent = (consented) => window.dispatchEvent(new window.CustomEvent('consent.update', { detail: { consented } }));
    consent(false);
    assert.equal(document.querySelector('.concierge-launcher'), null);
    assert.equal(document.querySelector('#concierge-panel'), null);
    consent(false); // already gone: no error
    const calls = [];
    window.alloy = (...args) => { calls.push(args); return Promise.resolve(); };
    consent(true);
    assert.ok(document.querySelector('.concierge-launcher'), 'back after accepting');
    assert.deepEqual(calls, [['setConsent', OPT_IN]], 'Web SDK opted back in');
    consent(true); // already mounted: no second launcher
    assert.equal(document.querySelectorAll('.concierge-launcher').length, 1);
    delete window.alloy;
  });

  test('init does nothing with ?concierge=off or off-surface', () => {
    window.history.replaceState(null, '', '/?concierge=off');
    assert.equal(init(), null);
    window.history.replaceState(null, '', '/contact');
    assert.equal(init(), null);
    assert.equal(document.querySelector('.concierge-launcher'), null);
  });
});
