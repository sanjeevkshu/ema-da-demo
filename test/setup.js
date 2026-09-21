/*
 * Shared jsdom bootstrap for block unit tests running under `node --test`.
 * Blocks are browser modules (they touch document/window/matchMedia), so we
 * stand up a jsdom window and mirror the globals a decorate() function expects.
 */
import { JSDOM } from 'jsdom';

/*
 * Importing a block pulls in scripts/scripts.js, which auto-runs loadPage() at
 * module load. Against a bare jsdom document (no fully-built sections) its
 * eager/lazy passes reject asynchronously — a bootstrap side effect that cannot
 * occur in a real browser page. Swallow ONLY those known bootstrap rejections so
 * they don't fail otherwise-passing test files; anything else is re-thrown.
 */
const BOOTSTRAP_ERRORS = [
  "reading 'dataset'",
  "reading 'querySelector'",
  "reading 'querySelectorAll'",
];
if (!global.blockTestRejectionGuard) {
  global.blockTestRejectionGuard = true;
  process.on('unhandledRejection', (reason) => {
    const msg = reason && reason.message ? reason.message : String(reason);
    const isBootstrap = BOOTSTRAP_ERRORS.some((e) => msg.includes(e));
    if (!isBootstrap) throw reason;
  });
}

// A complete-enough page skeleton that scripts.js's auto-run loadPage() can
// decorate without throwing: a <main> with one already-formed .section, plus
// the <header>/<footer> loadLazy expects. Keeps module bootstrap side effects
// from rejecting against a bare document.
const DEFAULT_HTML = '<!doctype html><html><head></head><body>'
  + '<header></header>'
  + '<main><div class="section" data-section-status="loaded"></div></main>'
  + '<footer></footer>'
  + '</body></html>';

export function installDom(html = DEFAULT_HTML) {
  const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' });
  const { window } = dom;

  // matchMedia is not implemented by jsdom — provide a controllable stub.
  window.matchMedia = window.matchMedia || ((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  }));

  // Mirror the DOM globals onto Node's global so block modules resolve them.
  global.window = window;
  global.document = window.document;
  // `navigator` is a read-only getter on the Node global in modern versions —
  // define it non-throwingly rather than assigning.
  try {
    global.navigator = window.navigator;
  } catch {
    Object.defineProperty(global, 'navigator', {
      value: window.navigator, configurable: true, writable: true,
    });
  }
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.Event = window.Event;
  global.CustomEvent = window.CustomEvent;
  global.KeyboardEvent = window.KeyboardEvent;
  global.MouseEvent = window.MouseEvent;
  global.PointerEvent = window.PointerEvent || window.MouseEvent;
  global.getComputedStyle = window.getComputedStyle.bind(window);

  return dom;
}

/**
 * Install a fake `fetch` on window/global. `routes` maps a URL substring to
 * either an HTML string (200) or `{ ok, status, text }`. Unmatched URLs 404.
 * Returns the list of requested URLs for assertions.
 */
export function mockFetch(routes = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (key === undefined) {
      return { ok: false, status: 404, async text() { return ''; } };
    }
    const val = routes[key];
    if (typeof val === 'string') {
      return { ok: true, status: 200, async text() { return val; } };
    }
    return {
      async text() { return ''; }, ok: true, status: 200, ...val,
    };
  };
  global.fetch = impl;
  window.fetch = impl;
  return calls;
}

/** Set whether prefers-reduced-motion should report as active. */
export function setReducedMotion(active) {
  window.matchMedia = (query) => ({
    matches: /prefers-reduced-motion/.test(query) ? active : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  });
}

/**
 * Build a generic block element from a class name and an array of rows, where
 * each row is an array of cell HTML strings. Produces DA-safe
 * `block › row › cell(s)` structure.
 *
 * buildBlock('stats', [['<p>10k</p>', '<p>Users</p>']])
 */
export function buildBlock(className, rows = []) {
  const block = document.createElement('div');
  block.className = className;
  rows.forEach((cells) => {
    const row = document.createElement('div');
    cells.forEach((html) => {
      const cell = document.createElement('div');
      cell.innerHTML = html;
      row.append(cell);
    });
    block.append(row);
  });
  return block;
}

/** Shorthand for a <picture> cell used by image-bearing blocks. */
export function picture(src = '/img/x.png', alt = 'image') {
  return `<picture><img src="${src}" alt="${alt}"></picture>`;
}

/**
 * Build a carousel block element with `n` slides, each a DA-safe row of
 * [media cell (picture), copy cell].
 */
export function buildCarousel(n, { thumbnails = false } = {}) {
  const block = document.createElement('div');
  block.className = `carousel${thumbnails ? ' thumbnails' : ''}`;
  for (let i = 0; i < n; i += 1) {
    const row = document.createElement('div');
    row.innerHTML = `<div><picture><img src="/img/${i}.png" alt="slide ${i}"></picture></div>`
      + `<div><h2>Slide ${i}</h2><p>Body ${i}</p></div>`;
    block.append(row);
  }
  return block;
}
