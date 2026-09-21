import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, mockFetch } from './setup.js';

installDom();
window.hlx = window.hlx || { codeBasePath: '', lighthouse: false };

const { default: decorate, loadFragment } = await import('../blocks/fragment/fragment.js');

describe('fragment: loadFragment', () => {
  beforeEach(() => { installDom(); window.hlx = { codeBasePath: '', lighthouse: false }; });

  test('returns a decorated main for a valid path', async () => {
    mockFetch({ '/frag.plain.html': '<div><h2>Frag</h2><p>Body</p></div>' });
    const main = await loadFragment('/frag');
    assert.ok(main);
    assert.equal(main.tagName, 'MAIN');
    assert.ok(main.querySelector('h2'));
  });

  test('returns null for an empty/invalid path', async () => {
    mockFetch({});
    assert.equal(await loadFragment(''), null);
    assert.equal(await loadFragment('//external'), null);
  });

  test('returns null when the fetch is not ok', async () => {
    mockFetch({}); // 404 for everything
    assert.equal(await loadFragment('/missing'), null);
  });
});

describe('fragment: decorate', () => {
  beforeEach(() => { installDom(); window.hlx = { codeBasePath: '', lighthouse: false }; });

  test('replaces a section when the fragment is its only child', async () => {
    mockFetch({ '/frag.plain.html': '<div><h2>Injected</h2></div>' });

    const section = document.createElement('div');
    section.className = 'section';
    const wrapper = document.createElement('div');
    wrapper.className = 'fragment-wrapper';
    const block = document.createElement('div');
    block.className = 'fragment';
    block.innerHTML = '<a href="/frag">/frag</a>';
    wrapper.append(block);
    section.append(wrapper);
    document.body.append(section);

    await decorate(block);
    // section replaced by the fragment's content
    assert.ok(document.body.querySelector('h2'));
  });

  test('is a no-op when the fragment cannot be loaded', async () => {
    mockFetch({});
    const section = document.createElement('div');
    section.className = 'section';
    const wrapper = document.createElement('div');
    wrapper.className = 'fragment-wrapper';
    const block = document.createElement('div');
    block.className = 'fragment';
    block.textContent = '/missing';
    wrapper.append(block);
    section.append(wrapper);
    document.body.append(section);

    await decorate(block);
    // wrapper still present (nothing injected)
    assert.ok(document.body.querySelector('.fragment-wrapper'));
  });
});
