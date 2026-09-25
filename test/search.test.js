import {
  test, describe, beforeEach,
} from 'node:test';
import assert from 'node:assert/strict';
import { installDom, mockFetch, buildBlock } from './setup.js';

installDom();
window.hlx = { codeBasePath: '' };

const {
  default: decorate, clearIndexCache, fetchIndex, highlight, scoreRow, searchIndex,
  statusText, toList, toTerms, toText, excerpt, MIN_CHARS,
} = await import('../blocks/search/search.js');

const ROWS = [
  {
    path: '/pulse-loop',
    title: 'PULSE Loop',
    description: 'Titanium smart ring with 7-day battery.',
    image: '/media_loop.png',
    headings: ['PULSE Loop', 'Sleep Decoded'],
    robots: '',
  },
  {
    path: '/know-the-brand',
    title: 'Know the Brand',
    description: 'Our story, from the sandbox stage to the ring on your finger.',
    image: '',
    headings: '["Our Manifesto","The Sandbox Stage"]',
    robots: '',
  },
  {
    path: '/hidden', title: 'Hidden ring page', description: 'ring', robots: 'noindex',
  },
  { title: 'No path ring' },
];

const indexRoute = (rows = ROWS) => ({ ok: true, json: async () => ({ data: rows }) });
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

function reset(query = '') {
  installDom();
  window.hlx = { codeBasePath: '' };
  clearIndexCache();
  window.history.replaceState(null, '', `/search${query}`);
}

describe('search: matching', () => {
  test('terms are lower-case, unique and non-empty', () => {
    assert.deepEqual(toTerms('  Ring  ring LOOP '), ['ring', 'loop']);
    assert.deepEqual(toTerms(''), []);
  });

  test('headings arrive as arrays or JSON strings', () => {
    assert.deepEqual(toList(['a']), ['a']);
    assert.deepEqual(toList('["a","b"]'), ['a', 'b']);
    assert.deepEqual(toList('plain'), ['plain']);
    assert.deepEqual(toList('{"a":1}'), ['{"a":1}']);
    assert.deepEqual(toList(undefined), []);
  });

  test('every term must match; title hits outrank description hits', () => {
    assert.equal(scoreRow(ROWS[0], ['loop', 'nothing']), 0);
    assert.ok(scoreRow(ROWS[0], ['loop']) > scoreRow(ROWS[1], ['ring']));
    assert.equal(scoreRow({}, ['x']), 0);
  });

  test('skips noindex and path-less rows, ranks by score then title', () => {
    const hits = searchIndex(ROWS, 'ring');
    assert.deepEqual(hits.map((r) => r.path), ['/know-the-brand', '/pulse-loop']);
    assert.deepEqual(searchIndex(ROWS, 'sandbox').map((r) => r.path), ['/know-the-brand']);
    assert.deepEqual(searchIndex(ROWS, '   '), []);
    const tie = searchIndex([{ path: '/b', title: 'B x' }, { path: '/a', title: 'A x' }, { path: '/c' }], 'x');
    assert.deepEqual(tie.map((r) => r.path), ['/a', '/b']);
  });

  test('highlight wraps matches in <mark> without parsing HTML', () => {
    const host = document.createElement('p');
    host.append(highlight('Ring <b> the RING', ['ring', 'a.b']));
    assert.equal(host.innerHTML, '<mark>Ring</mark> &lt;b&gt; the <mark>RING</mark>');
    const plain = document.createElement('p');
    plain.append(highlight('text', []));
    assert.equal(plain.innerHTML, 'text');
    const empty = document.createElement('p');
    empty.append(highlight(undefined, ['x']));
    assert.equal(empty.innerHTML, '');
  });

  test('status text counts and suggests', () => {
    assert.equal(statusText(1, 'loop'), '1 result for “loop”');
    assert.equal(statusText(3, 'ring'), '3 results for “ring”');
    assert.match(statusText(0, 'zzz'), /^No results for “zzz”/);
  });
});

describe('search: page text', () => {
  const words = (n, w = 'word') => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ');

  test('page text chunks become one normalised string', () => {
    assert.equal(toText(['Specs\n\nBattery', '  12 hours ']), 'Specs Battery 12 hours');
    assert.equal(toText('["a","b"]'), 'a b');
    assert.equal(toText(undefined), '');
  });

  test('excerpt centres the first match and cuts on word boundaries', () => {
    const text = `${words(40)} Battery 12 hours mixed AR use ${words(40, 'tail')}`;
    const out = excerpt([text], ['battery']);
    assert.match(out, /^… word\d+ .*Battery 12 hours .* tail\d+ …$/);
    assert.ok(out.length < 200);
    assert.equal(excerpt(['Battery lasts 7 days'], ['battery']), 'Battery lasts 7 days');
    assert.equal(excerpt(['no match here'], ['zzz']), '');
    assert.equal(excerpt(undefined, ['x']), '');
  });

  test('excerpt never cuts through the matched term', () => {
    const long = `${'x'.repeat(200)}needle${'y'.repeat(200)}`;
    const out = excerpt([long], ['needle']);
    assert.ok(out.includes('needle'));
    assert.match(out, /^… .*needle.* …$/);
  });

  test('a page-text-only hit is found, and ranks below title hits', () => {
    const rows = [
      { path: '/arc', title: 'PULSE Arc', content: ['Battery 7 days continuous tracking'] },
      { path: '/battery-guide', title: 'Battery guide' },
    ];
    assert.deepEqual(searchIndex(rows, 'battery').map((r) => r.path), ['/battery-guide', '/arc']);
    assert.equal(scoreRow(rows[0], ['battery']), 1);
  });
});

describe('search: index loading', () => {
  beforeEach(() => reset());

  test('fetches once per source and caches', async () => {
    const calls = mockFetch({ '/query-index.json': indexRoute() });
    await fetchIndex('/query-index.json');
    await fetchIndex('/query-index.json');
    assert.equal(calls.length, 1);
  });

  test('a failed, malformed or rejected fetch yields no rows', async () => {
    mockFetch({});
    assert.deepEqual(await fetchIndex('/missing.json'), []);
    mockFetch({ '/bad.json': { ok: true, json: async () => ({ data: 'x' }) } });
    assert.deepEqual(await fetchIndex('/bad.json'), []);
    global.fetch = async () => { throw new Error('offline'); };
    assert.deepEqual(await fetchIndex('/offline.json'), []);
  });
});

describe('search: block', () => {
  beforeEach(() => reset());

  test('builds a labelled GET form, a status region and a result list', async () => {
    const block = buildBlock('search');
    document.body.append(block);
    await decorate(block);
    const form = block.querySelector('form[role="search"]');
    assert.equal(form.method, 'get');
    const input = form.querySelector('input[type="search"][name="q"]');
    assert.equal(form.querySelector('label').htmlFor, input.id);
    assert.equal(block.querySelector('.search-status').getAttribute('role'), 'status');
    assert.ok(block.querySelector('ul.search-results'));
  });

  test('runs the ?q= query on load and renders highlighted results', async () => {
    reset('?q=loop');
    mockFetch({ '/query-index.json': indexRoute() });
    const block = buildBlock('search');
    document.body.append(block);
    await decorate(block);
    const items = block.querySelectorAll('.search-results li');
    assert.equal(items.length, 1);
    const link = items[0].querySelector('a.search-result');
    assert.equal(link.getAttribute('href'), '/pulse-loop');
    assert.equal(link.querySelectorAll('a').length, 0, 'no nested links');
    assert.equal(link.querySelector('h2 mark').textContent, 'Loop');
    assert.equal(link.querySelector('img').getAttribute('alt'), '', 'image is decorative');
    assert.equal(block.querySelector('.search-status').textContent, '1 result for “loop”');
  });

  test('uses an authored index link and renders rows without image or description', async () => {
    mockFetch({ '/custom-index.json': indexRoute([{ path: '/x', title: 'Ring X' }]) });
    const block = buildBlock('search', [['<a href="/custom-index.json">index</a>']]);
    document.body.append(block);
    await decorate(block);
    const input = block.querySelector('input');
    input.value = 'ring';
    block.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await wait(0);
    const result = block.querySelector('.search-result');
    assert.equal(result.querySelector('.search-result-image'), null);
    assert.equal(result.querySelector('.search-result-description'), null);
    assert.equal(new URL(window.location.href).searchParams.get('q'), 'ring');
  });

  test('typing is debounced; short queries clear results and the URL', async () => {
    mockFetch({ '/query-index.json': indexRoute() });
    const block = buildBlock('search');
    document.body.append(block);
    await decorate(block);
    const input = block.querySelector('input');
    input.dispatchEvent(new window.Event('focus'));
    input.value = 'ring';
    input.dispatchEvent(new window.Event('input'));
    input.dispatchEvent(new window.Event('input'));
    assert.equal(block.querySelectorAll('.search-results li').length, 0, 'not yet');
    await wait(260);
    assert.equal(block.querySelectorAll('.search-results li').length, 2);

    input.value = 'r'.repeat(MIN_CHARS - 1);
    input.dispatchEvent(new window.Event('input'));
    await wait(260);
    assert.equal(block.querySelectorAll('.search-results li').length, 0);
    assert.equal(block.querySelector('.search-status').textContent, '');

    input.value = '';
    block.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await wait(0);
    assert.equal(new URL(window.location.href).searchParams.has('q'), false);
  });

  test('a stale response never overwrites a newer query', async () => {
    let release;
    const slow = new Promise((r) => { release = r; });
    global.fetch = async () => { await slow; return indexRoute(); };
    window.fetch = global.fetch;
    const block = buildBlock('search');
    document.body.append(block);
    await decorate(block);
    const input = block.querySelector('input');
    const form = block.querySelector('form');
    input.value = 'loop';
    form.dispatchEvent(new window.Event('submit', { cancelable: true }));
    input.value = 'x';
    form.dispatchEvent(new window.Event('submit', { cancelable: true }));
    release();
    await wait(10);
    assert.equal(block.querySelectorAll('.search-results li').length, 0);
    assert.equal(block.querySelector('.search-status').textContent, '');
  });

  test('shows an excerpt when only the page text matches, else the description', async () => {
    reset('?q=hours');
    mockFetch({
      '/query-index.json': indexRoute([
        {
          path: '/pulse-vision-ar',
          title: 'PULSE Vision AR',
          description: 'Featherweight AR lens.',
          content: ['Battery', '12 hours mixed AR use'],
        },
        {
          path: '/hours', title: 'Opening hours', description: 'Our lab hours.', content: ['hours text'],
        },
      ]),
    });
    const block = buildBlock('search');
    document.body.append(block);
    await decorate(block);
    const [first, second] = [...block.querySelectorAll('.search-result')];
    assert.equal(first.getAttribute('href'), '/hours');
    assert.equal(first.querySelector('.search-result-description').textContent, 'Our lab hours.');
    const snippet = second.querySelector('.search-result-description');
    assert.equal(snippet.textContent, 'Battery 12 hours mixed AR use');
    assert.equal(snippet.querySelector('mark').textContent, 'hours');
  });

  test('no results shows the suggestion', async () => {
    reset('?q=zzz');
    mockFetch({ '/query-index.json': indexRoute() });
    const block = buildBlock('search');
    document.body.append(block);
    await decorate(block);
    assert.match(block.querySelector('.search-status').textContent, /^No results/);
  });
});
