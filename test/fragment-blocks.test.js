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

  test('marks a nav item with a nested list as a dropdown, collapsed by default', async () => {
    const navHtml = '<div><p><a href="/">PULSE</a></p></div>'
      + '<div><ul>'
      + '<li><a href="/products">Products</a><ul><li><a href="/a">Arc</a></li></ul></li>'
      + '<li><a href="/contact">Contact</a></li>'
      + '</ul></div>'
      + '<div><p><a href="/shop">Shop</a></p></div>';
    mockFetch({ '/nav.plain.html': navHtml });
    const block = document.createElement('div');
    await decorateHeader(block);
    const drop = block.querySelector('.nav-drop');
    assert.ok(drop, 'nav-drop marked');
    assert.equal(drop.getAttribute('aria-expanded'), 'false', 'starts collapsed');
  });

  test('clicking a Products dropdown toggles it open then closed', async () => {
    const navHtml = '<div><p><a href="/">PULSE</a></p></div>'
      + '<div><ul>'
      + '<li><a href="/product-discovery">Products</a><ul>'
      + '<li><a href="/pulse-loop">PULSE Loop</a></li>'
      + '<li><a href="/pulse-band-neo">PULSE Band Neo</a></li>'
      + '</ul></li>'
      + '<li><a href="/contact">Contact</a></li>'
      + '</ul></div>'
      + '<div><p><a href="/shop">Shop</a></p></div>';
    mockFetch({ '/nav.plain.html': navHtml });
    const block = document.createElement('div');
    await decorateHeader(block);
    const drop = block.querySelector('.nav-drop');
    const topLink = drop.querySelector(':scope > a');
    // click the top-level label → expands
    topLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(drop.getAttribute('aria-expanded'), 'true', 'opens on click');
    // click again → collapses
    topLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(drop.getAttribute('aria-expanded'), 'false', 'closes on second click');
  });

  test('clicking a submenu link does not toggle the dropdown (lets it navigate)', async () => {
    const navHtml = '<div><p><a href="/">PULSE</a></p></div>'
      + '<div><ul>'
      + '<li><a href="/product-discovery">Products</a><ul>'
      + '<li><a href="/pulse-loop">PULSE Loop</a></li>'
      + '</ul></li>'
      + '</ul></div>'
      + '<div><p><a href="/shop">Shop</a></p></div>';
    mockFetch({ '/nav.plain.html': navHtml });
    const block = document.createElement('div');
    await decorateHeader(block);
    const drop = block.querySelector('.nav-drop');
    drop.querySelector(':scope > a').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(drop.getAttribute('aria-expanded'), 'true');
    // clicking a submenu item should NOT collapse (handler returns early)
    const submenuLink = drop.querySelector(':scope > ul a');
    submenuLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(drop.getAttribute('aria-expanded'), 'true', 'submenu click leaves dropdown open');
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

  // Serve widget modules from test/fixtures/widgets. A <link> for the widget CSS
  // is added up front because jsdom never fires stylesheet load events, so
  // loadCSS would otherwise wait forever.
  function mountWidget(name) {
    const base = new URL('./fixtures', import.meta.url).href;
    window.hlx.codeBasePath = base;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${base}/widgets/${name}.css`;
    document.head.append(css);
    mockFetch({ [`/widgets/${name}.html`]: `<p class="${name}-html">loaded</p>` });

    const container = document.createElement('div');
    container.className = 'widget-container';
    const wrapper = document.createElement('div');
    wrapper.className = 'widget-wrapper';
    const block = document.createElement('div');
    block.className = 'widget block';
    block.innerHTML = `<a href="http://localhost/widgets/${name}.html">${name}</a>`;
    wrapper.append(block);
    container.append(wrapper);
    document.body.append(container);
    return { block, container };
  }

  test('runs the widget module default export and reclasses the container', async () => {
    const { block, container } = mountWidget('demo');
    await decorateWidget(block);
    assert.equal(block.dataset.decorated, 'true', 'module decorate ran');
    assert.ok(container.classList.contains('demo-container'));
    assert.equal(container.classList.contains('widget-container'), false);
  });

  test('accepts a widget module without a default export', async () => {
    const { block } = mountWidget('plain');
    await decorateWidget(block);
    assert.ok(block.querySelector('.plain-html'), 'widget html injected');
    assert.equal(block.dataset.decorated, undefined);
  });

  test('resolves widgets in a subfolder under /widgets/', async () => {
    const calls = mockFetch({ '/widgets/promos/banner.html': '<p>banner</p>' });
    const block = document.createElement('div');
    block.className = 'widget block';
    block.innerHTML = '<a href="http://localhost/widgets/promos/banner.html">banner</a>';
    await decorateWidget(block);
    assert.ok(block.classList.contains('banner'));
    assert.ok(calls.includes('/widgets/promos/banner.html'), 'fetched from the subfolder');
  });
});
