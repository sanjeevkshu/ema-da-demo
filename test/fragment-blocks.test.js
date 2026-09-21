import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, mockFetch } from './setup.js';

// window.hlx must exist before scripts.js (imported transitively) initialises.
installDom();
window.hlx = window.hlx || { codeBasePath: '', lighthouse: false };

const { default: decorateFooter } = await import('../blocks/footer/footer.js');
const { default: decorateHeader } = await import('../blocks/header/header.js');
const { default: decorateWidget } = await import('../blocks/widget/widget.js');

function resetHlx() {
  window.hlx = { codeBasePath: '', lighthouse: false };
}

describe('footer', () => {
  beforeEach(() => { installDom(); resetHlx(); });

  test('restructures the flat fragment into columns + bottom bar', async () => {
    // getMetadata('footer') reads <meta name="footer">; leave empty → '/footer'
    const footerHtml = '<div class="default-content-wrapper">'
      + '<p><a href="/">PULSE</a></p>'
      + '<p>Tagline copy</p>'
      + '<p><strong>PRODUCTS</strong></p>'
      + '<ul><li><a href="/a">Arc</a></li><li><a href="/b">Loop</a></li></ul>'
      + '<p><strong>EXPLORE</strong></p>'
      + '<ul><li><a href="/c">Brand</a></li></ul>'
      + '<p>© 2026 PULSE</p>'
      + '<p>DESIGNED FOR HUMANS</p>'
      + '</div>';
    mockFetch({ '/footer.plain.html': footerHtml });

    const block = document.createElement('div');
    document.body.append(block);
    await decorateFooter(block);

    assert.ok(block.querySelector('.footer-columns'), 'columns row');
    assert.ok(block.querySelector('.footer-col-brand'), 'brand column');
    // two link columns (PRODUCTS, EXPLORE) + brand
    assert.equal(block.querySelectorAll('.footer-col').length, 3);
    const bottom = block.querySelector('.footer-bottom');
    assert.ok(bottom, 'bottom bar');
    assert.equal(bottom.querySelectorAll('p').length, 2, 'two bottom lines');
  });

  test('tags a multi-link paragraph as socials', async () => {
    const footerHtml = '<div class="default-content-wrapper">'
      + '<p><a href="/">PULSE</a></p>'
      + '<p><strong>SOCIAL</strong></p>'
      + '<p><a href="/x">X</a> <a href="/ig">IG</a> <a href="/yt">YT</a></p>'
      + '<p>© 2026</p>'
      + '</div>';
    mockFetch({ '/footer.plain.html': footerHtml });
    const block = document.createElement('div');
    document.body.append(block);
    await decorateFooter(block);
    assert.ok(block.querySelector('.footer-socials'));
  });
});

describe('header', () => {
  beforeEach(() => { installDom(); resetHlx(); });

  test('renders a nav with brand, sections and tools from the fragment', async () => {
    // three sibling sections: brand, sections (nav links), tools — as in nav.plain.html
    const navHtml = '<div><p><a href="/know-the-brand">PULSE</a></p></div>'
      + '<div><ul><li><a href="/product-discovery">Products</a></li>'
      + '<li><a href="/contact">Contact</a></li></ul></div>'
      + '<div><p><a href="/shop">Shop Now</a></p></div>';
    mockFetch({ '/nav.plain.html': navHtml });

    const block = document.createElement('div');
    await decorateHeader(block);

    const nav = block.querySelector('#nav');
    assert.ok(nav, 'nav element');
    assert.ok(nav.querySelector('.nav-brand'), 'brand section');
    assert.ok(nav.querySelector('.nav-sections'), 'sections');
    assert.ok(nav.querySelector('.nav-hamburger'), 'hamburger button');
  });

  test('marks a nav item with a nested list as a dropdown', async () => {
    const navHtml = '<div><p><a href="/">PULSE</a></p></div>'
      + '<div><ul>'
      + '<li><a href="/products">Products</a><ul><li><a href="/a">Arc</a></li></ul></li>'
      + '<li><a href="/contact">Contact</a></li>'
      + '</ul></div>'
      + '<div><p><a href="/shop">Shop</a></p></div>';
    mockFetch({ '/nav.plain.html': navHtml });
    const block = document.createElement('div');
    await decorateHeader(block);
    assert.ok(block.querySelector('.nav-drop'), 'nav-drop marked');
  });

  test('hamburger click toggles the nav expanded state', async () => {
    const navHtml = '<div><p><a href="/">PULSE</a></p></div>'
      + '<div><ul><li><a href="/products">Products</a></li></ul></div>'
      + '<div><p><a href="/shop">Shop</a></p></div>';
    mockFetch({ '/nav.plain.html': navHtml });
    const block = document.createElement('div');
    await decorateHeader(block);
    const nav = block.querySelector('#nav');
    const button = nav.querySelector('.nav-hamburger button');
    const before = nav.getAttribute('aria-expanded');
    button.parentElement.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.notEqual(nav.getAttribute('aria-expanded'), before);
  });

  test('Escape keydown does not throw after decorate', async () => {
    const navHtml = '<div><p><a href="/">PULSE</a></p></div>'
      + '<div><ul><li><a href="/products">Products</a></li></ul></div>'
      + '<div><p><a href="/shop">Shop</a></p></div>';
    mockFetch({ '/nav.plain.html': navHtml });
    const block = document.createElement('div');
    await decorateHeader(block);
    // exercise the global escape handler wired by toggleMenu
    window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Escape' }));
    assert.ok(true);
  });
});

describe('widget', () => {
  beforeEach(() => { installDom(); resetHlx(); });

  test('loads widget html/js and applies shell classes', async () => {
    const calls = mockFetch({
      '/widgets/demo.html': '<p class="widget-loaded">hi</p>',
      '/widgets/demo.css': '',
      '/widgets/demo.js': '',
    });

    const block = document.createElement('div');
    block.className = 'widget block';
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-wrapper';
    wrapper.append(block);
    block.innerHTML = '<a href="http://localhost/widgets/demo.html?theme=dark">demo</a>';

    await decorateWidget(block);

    assert.ok(block.classList.contains('demo'), 'widget name class');
    assert.equal(block.classList.contains('block'), false, 'block class removed');
    assert.equal(block.dataset.theme, 'dark', 'query param → dataset');
    assert.ok(wrapper.classList.contains('demo-wrapper'), 'wrapper reclassed');
    assert.ok(block.querySelector('.widget-loaded'), 'widget html injected');
    assert.ok(calls.some((u) => u.includes('/widgets/demo.html')));
  });

  test('logs and recovers when the widget fetch fails', async () => {
    // no routes → fetch resolves 404, .text() empty; import of .js will throw
    mockFetch({});
    const block = document.createElement('div');
    block.className = 'widget block';
    block.innerHTML = '<a href="http://localhost/widgets/missing.js.html">x</a>';
    // should not throw out of decorate (errors are caught + logged)
    await decorateWidget(block);
    assert.ok(true);
  });
});
