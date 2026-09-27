/* Consent: stored choice, overrides, the banner and "Cookie settings". */
import {
  test, describe, beforeEach,
} from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.js';

installDom();
window.hlx = { codeBasePath: '' };

const {
  CONSENT_KEY, CONSENT_VERSION, applyChoice, choose, initConsent, queryOverride, readChoice,
  saveChoice,
} = await import('../scripts/consent-check.js');
const { default: showBanner } = await import('../scripts/consent-banner.js');

const tick = () => new Promise((r) => { setTimeout(r, 0); });
async function waitFor(fn, tries = 50) {
  for (let i = 0; i < tries; i += 1) {
    const value = fn();
    if (value) return value;
    // eslint-disable-next-line no-await-in-loop
    await tick();
  }
  return fn();
}
function reset(search = '') {
  installDom();
  window.hlx = { codeBasePath: '' };
  window.localStorage.clear();
  window.history.replaceState(null, '', `/${search}`);
}
function events() {
  const seen = [];
  window.addEventListener('consent.update', (e) => seen.push(e.detail.consented));
  return seen;
}

describe('consent: stored choice', () => {
  beforeEach(() => reset());

  test('saves and reads back a versioned choice', () => {
    assert.equal(readChoice(), null);
    saveChoice('accepted');
    assert.equal(readChoice(), 'accepted');
    const saved = JSON.parse(window.localStorage.getItem(CONSENT_KEY));
    assert.equal(saved.version, CONSENT_VERSION);
    assert.ok(Date.parse(saved.date));
  });

  test('an outdated, unknown or corrupt choice counts as no choice', () => {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ status: 'accepted', version: 0 }));
    assert.equal(readChoice(), null, 'outdated version asks again');
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ status: 'maybe', version: CONSENT_VERSION }));
    assert.equal(readChoice(), null);
    window.localStorage.setItem(CONSENT_KEY, '{nope');
    assert.equal(readChoice(), null);
  });

  test('blocked storage never throws', () => {
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(readChoice(blocked), null);
    assert.doesNotThrow(() => saveChoice('declined', blocked));
  });

  test('?consent= overrides for one page view', () => {
    assert.equal(queryOverride('?consent=accept'), 'accepted');
    assert.equal(queryOverride('?consent=TRUE'), 'accepted');
    assert.equal(queryOverride('?consent=decline'), 'declined');
    assert.equal(queryOverride('?other=1'), null);
  });
});

describe('consent: applying a choice', () => {
  beforeEach(() => reset());

  test('fires consent.update and saves the choice', () => {
    const seen = events();
    applyChoice('declined');
    choose('accepted');
    assert.deepEqual(seen, [false, true]);
    assert.equal(readChoice(), 'accepted');
  });

  test('a stored or overridden choice applies without a banner', async () => {
    saveChoice('declined');
    const seen = events();
    initConsent();
    await tick();
    assert.deepEqual(seen, [false]);
    assert.equal(document.querySelector('.consent-banner'), null);

    reset('?consent=accept');
    saveChoice('declined');
    const seen2 = events();
    initConsent();
    assert.deepEqual(seen2, [true], 'the override wins for this view');
  });

  test('no choice yet opens the banner without taking focus', async () => {
    initConsent();
    const banner = await waitFor(() => document.querySelector('.consent-banner'));
    assert.ok(banner);
    assert.notEqual(document.activeElement.closest?.('.consent-banner'), banner);
    assert.equal(typeof window.pulseConsent.open, 'function');
    assert.equal(window.pulseConsent.get(), null);
  });

  test('a "Cookie settings" link reopens the banner with the current choice', async () => {
    saveChoice('accepted');
    initConsent();
    const link = document.createElement('a');
    link.href = '/#cookie-settings';
    link.textContent = 'Cookie settings';
    document.body.append(link);
    link.focus();
    link.click();
    const banner = await waitFor(() => document.querySelector('.consent-banner'));
    assert.match(banner.querySelector('.consent-current').textContent, /accepted/);
    assert.equal(document.activeElement, banner.querySelector('button[data-choice]'));
    banner.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(document.querySelector('.consent-banner'), null);
    assert.equal(document.activeElement, link, 'focus returns to the link');
    document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });

  test('window.pulseConsent.open reopens it too', async () => {
    saveChoice('declined');
    initConsent();
    await window.pulseConsent.open();
    assert.match(document.querySelector('.consent-banner .consent-current').textContent, /declined/);
  });
});

describe('consent: banner', () => {
  beforeEach(() => reset());

  test('is a labelled, non-modal dialog with two equal choices', () => {
    const banner = showBanner();
    assert.equal(banner.getAttribute('role'), 'dialog');
    assert.equal(banner.getAttribute('aria-modal'), 'false');
    assert.equal(document.getElementById(banner.getAttribute('aria-labelledby')).textContent, 'Cookies and Ask PULSE');
    assert.ok(document.getElementById(banner.getAttribute('aria-describedby')));
    const buttons = [...banner.querySelectorAll('button[data-choice]')];
    assert.deepEqual(buttons.map((b) => b.dataset.choice), ['declined', 'accepted']);
    assert.equal(new Set(buttons.map((b) => b.className)).size, 1, 'same styling for both');
    assert.ok(banner.querySelector('a[href="/privacy"]'));
    assert.equal(banner.querySelector('.consent-current'), null, 'no current choice shown first time');
  });

  test('choosing reports the choice and closes the banner', () => {
    const chosen = [];
    const banner = showBanner({ onChoice: (c) => chosen.push(c) });
    banner.querySelector('[data-choice="accepted"]').click();
    assert.deepEqual(chosen, ['accepted']);
    assert.equal(document.querySelector('.consent-banner'), null);
    showBanner({ onChoice: (c) => chosen.push(c) }).querySelector('[data-choice="declined"]').click();
    assert.deepEqual(chosen, ['accepted', 'declined']);
  });

  test('Escape does not dismiss a first-time banner; only one banner at a time', () => {
    const banner = showBanner();
    banner.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.ok(banner.isConnected);
    showBanner({ current: 'declined', reopened: true });
    assert.equal(document.querySelectorAll('.consent-banner').length, 1);
    assert.equal(document.querySelectorAll('link[href$="/styles/consent-banner.css"]').length, 1);
  });
});
