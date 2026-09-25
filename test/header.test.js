import {
  test, describe, beforeEach,
} from 'node:test';
import assert from 'node:assert/strict';
import { installDom, mockFetch } from './setup.js';

// header.js reads `matchMedia('(min-width: 900px)')` once, at import. Hand it a
// media-query object the tests can flip, so desktop and mobile paths both run.
installDom();
window.hlx = { codeBasePath: '', lighthouse: false };
const desktop = {
  matches: false,
  media: '(min-width: 900px)',
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
};
const baseMatchMedia = window.matchMedia;
window.matchMedia = (q) => (q.includes('900px') ? desktop : baseMatchMedia(q));

const { default: decorateHeader } = await import('../blocks/header/header.js');

const NAV = '<div><p><a href="/">PULSE</a></p></div>'
  + '<div><ul>'
  + '<li><a href="/product-discovery">Products</a><ul>'
  + '<li><a href="/pulse-loop">PULSE Loop</a></li>'
  + '</ul></li>'
  + '<li><a href="/contact">Contact</a></li>'
  + '</ul></div>'
  + '<div><p><a href="/product-discovery">Shop Now</a></p></div>';

async function mountHeader(navHtml = NAV) {
  mockFetch({ '/nav.plain.html': navHtml });
  const block = document.createElement('div');
  document.body.append(block); // closeOnEscape looks the nav up by id
  await decorateHeader(block);
  const nav = block.querySelector('#nav');
  return { nav, drop: nav.querySelector('.nav-drop') };
}

const escape = () => window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Escape' }));
const focusOut = (nav, relatedTarget) => nav.dispatchEvent(
  new window.FocusEvent('focusout', { relatedTarget, bubbles: true }),
);

describe('header: brand link', () => {
  beforeEach(() => { installDom(); window.hlx = { codeBasePath: '', lighthouse: false }; });

  test('strips button styling from a bold logo link instead of throwing', async () => {
    // a bold link is decorated into p.button-wrapper > a.button by scripts.js
    const { nav } = await mountHeader(NAV.replace(
      '<p><a href="/">PULSE</a></p>',
      '<p><strong><a href="/">PULSE</a></strong></p>',
    ));
    const logo = nav.querySelector('.nav-brand a');
    assert.equal(logo.className, '', 'logo loses the button class');
    assert.equal(logo.closest('p').className, '', 'its wrapper loses button-wrapper');
  });
});

describe('header: desktop', () => {
  beforeEach(() => {
    installDom();
    window.hlx = { codeBasePath: '', lighthouse: false };
    desktop.matches = true;
  });

  test('dropdowns are keyboard-focusable', async () => {
    const { drop } = await mountHeader();
    assert.equal(drop.getAttribute('tabindex'), '0');
  });

  test('Enter on a focused dropdown toggles it', async () => {
    const { drop } = await mountHeader();
    drop.focus();
    assert.equal(document.activeElement, drop);
    drop.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    assert.equal(drop.getAttribute('aria-expanded'), 'true');
  });

  test('Escape collapses an open dropdown', async () => {
    const { drop } = await mountHeader();
    drop.querySelector(':scope > a').click();
    assert.equal(drop.getAttribute('aria-expanded'), 'true');
    escape();
    assert.equal(drop.getAttribute('aria-expanded'), 'false');
  });

  test('moving focus out of the nav collapses an open dropdown', async () => {
    const { nav, drop } = await mountHeader();
    drop.querySelector(':scope > a').click();
    focusOut(nav, document.body);
    assert.equal(drop.getAttribute('aria-expanded'), 'false');
  });

  test('keys other than Escape leave the nav alone', async () => {
    const { drop } = await mountHeader();
    drop.querySelector(':scope > a').click();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyA' }));
    assert.equal(drop.getAttribute('aria-expanded'), 'true');
  });
});

describe('header: mobile', () => {
  beforeEach(() => {
    installDom();
    window.hlx = { codeBasePath: '', lighthouse: false };
    desktop.matches = false;
  });

  const openMenu = (nav) => nav.querySelector('.nav-hamburger').click();

  test('dropdowns are not tab stops', async () => {
    const { drop } = await mountHeader();
    assert.equal(drop.hasAttribute('tabindex'), false);
  });

  test('Escape closes the open menu', async () => {
    const { nav } = await mountHeader();
    openMenu(nav);
    assert.equal(nav.getAttribute('aria-expanded'), 'true');
    escape();
    assert.equal(nav.getAttribute('aria-expanded'), 'false');
  });

  test('moving focus out of the nav closes the open menu', async () => {
    const { nav } = await mountHeader();
    openMenu(nav);
    focusOut(nav, document.body);
    assert.equal(nav.getAttribute('aria-expanded'), 'false');
  });

  test('focus moving within the nav keeps the menu open', async () => {
    const { nav } = await mountHeader();
    openMenu(nav);
    focusOut(nav, nav.querySelector('a'));
    assert.equal(nav.getAttribute('aria-expanded'), 'true');
  });
});
