import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './setup.js';

installDom();
const { default: decorate } = await import('../blocks/hero/hero.js');

function heroSplit() {
  const block = document.createElement('div');
  block.className = 'hero split';
  const row = document.createElement('div');
  row.innerHTML = '<div><h1>Title</h1><p>Lead</p></div>'
    + '<div><picture><img src="/hero.png" alt="hero"></picture></div>';
  block.append(row);
  return block;
}

function heroBackdrop() {
  const block = document.createElement('div');
  block.className = 'hero backdrop';
  const row = document.createElement('div');
  row.innerHTML = '<div>'
    + '<p><em>Featured</em></p><h1>Your Life, Amplified</h1>'
    + '<p>Biometric wearables.</p>'
    + '<p><picture><img src="/bg.png" alt="bg"></picture></p>'
    + '</div>';
  block.append(row);
  return block;
}

describe('hero: split variant', () => {
  beforeEach(() => installDom());

  test('tags media and text cells', () => {
    const block = heroSplit();
    decorate(block);
    assert.ok(block.querySelector('.hero-media'), 'media cell tagged');
    assert.ok(block.querySelector('.hero-text'), 'text cell tagged');
    assert.ok(block.querySelector('.hero-media picture'), 'picture in media cell');
  });

  test('leaves the block otherwise intact', () => {
    const block = heroSplit();
    decorate(block);
    assert.ok(block.querySelector('h1'));
    assert.equal(block.querySelectorAll('.hero-text').length, 1);
  });
});

describe('hero: backdrop variant', () => {
  beforeEach(() => installDom());

  test('promotes the picture to a full-bleed backdrop', () => {
    const block = heroBackdrop();
    decorate(block);
    const media = block.querySelector('.hero-backdrop-media');
    assert.ok(media, 'backdrop media created');
    assert.ok(media.querySelector('picture'), 'picture moved into backdrop');
  });

  test('wraps remaining copy in an overlay card', () => {
    const block = heroBackdrop();
    decorate(block);
    const overlay = block.querySelector('.hero-overlay');
    assert.ok(overlay, 'overlay created');
    assert.ok(overlay.querySelector('h1'), 'heading in overlay');
    assert.ok(overlay.querySelector('em'), 'eyebrow in overlay');
    // the picture must NOT remain inside the overlay
    assert.equal(overlay.querySelector('picture'), null);
  });

  test('is a no-op when no picture is authored', () => {
    const block = document.createElement('div');
    block.className = 'hero backdrop';
    block.innerHTML = '<div><div><h1>No image</h1></div></div>';
    decorate(block);
    // without a backdrop image it should not create backdrop media
    assert.equal(block.querySelector('.hero-backdrop-media'), null);
    assert.ok(block.querySelector('h1'));
  });

  test('handles a picture not wrapped in its own paragraph', () => {
    const block = document.createElement('div');
    block.className = 'hero backdrop';
    // picture is a direct child of the cell (no wrapping <p>)
    block.innerHTML = '<div><div>'
      + '<h1>Direct</h1><picture><img src="/bg.png" alt="bg"></picture>'
      + '</div></div>';
    decorate(block);
    assert.ok(block.querySelector('.hero-backdrop-media picture'));
    assert.equal(block.querySelector('.hero-overlay picture'), null);
    assert.ok(block.querySelector('.hero-overlay h1'));
  });

  test('keeps a paragraph that also carries text alongside the picture', () => {
    const block = document.createElement('div');
    block.className = 'hero backdrop';
    // the picture shares its <p> with caption text → the <p> must not be removed
    block.innerHTML = '<div><div>'
      + '<h1>Caption</h1>'
      + '<p>caption text <picture><img src="/bg.png" alt="bg"></picture></p>'
      + '</div></div>';
    decorate(block);
    assert.ok(block.querySelector('.hero-backdrop-media picture'));
    assert.ok(block.querySelector('h1'));
  });

  test('supports a single-level cell (no inner wrapper div)', () => {
    const block = document.createElement('div');
    block.className = 'hero backdrop';
    // only one level of div — exercises the innerCell fallback branch
    block.innerHTML = '<div>'
      + '<p><em>Eyebrow</em></p><h1>Flat</h1>'
      + '<p><picture><img src="/bg.png" alt="bg"></picture></p>'
      + '</div>';
    decorate(block);
    assert.ok(block.querySelector('.hero-backdrop-media picture'));
    assert.ok(block.querySelector('.hero-overlay h1'));
  });
});

describe('hero: plain variant', () => {
  beforeEach(() => installDom());

  test('leaves an unclassed hero untouched', () => {
    const block = document.createElement('div');
    block.className = 'hero';
    block.innerHTML = '<div><h1>Plain</h1></div>';
    decorate(block);
    assert.ok(block.querySelector('h1'));
    assert.equal(block.querySelector('.hero-backdrop-media'), null);
    assert.equal(block.querySelector('.hero-media'), null);
  });
});
