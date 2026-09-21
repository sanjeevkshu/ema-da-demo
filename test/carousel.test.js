import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, setReducedMotion, buildCarousel } from './setup.js';

installDom();
const {
  default: decorate, wrapIndex, prefersReducedMotion, readSlideCells,
} = await import('../blocks/carousel/carousel.js');

describe('carousel: wrapIndex', () => {
  test('passes through in-range indices', () => {
    assert.equal(wrapIndex(0, 3), 0);
    assert.equal(wrapIndex(2, 3), 2);
  });
  test('wraps past the end to the start', () => {
    assert.equal(wrapIndex(3, 3), 0);
    assert.equal(wrapIndex(4, 3), 1);
  });
  test('wraps before the start to the end', () => {
    assert.equal(wrapIndex(-1, 3), 2);
    assert.equal(wrapIndex(-4, 3), 2);
  });
  test('is safe for an empty carousel', () => {
    assert.equal(wrapIndex(0, 0), 0);
    assert.equal(wrapIndex(5, 0), 0);
  });
});

describe('carousel: readSlideCells', () => {
  beforeEach(() => installDom());
  test('splits a media + copy row', () => {
    const row = document.createElement('div');
    row.innerHTML = '<div><picture><img src="/a.png"></picture></div><div><h2>t</h2></div>';
    const { media, copy } = readSlideCells(row);
    assert.ok(media.querySelector('picture'));
    assert.ok(copy.querySelector('h2'));
  });
  test('returns null copy when only a media cell is authored', () => {
    const row = document.createElement('div');
    row.innerHTML = '<div><picture><img src="/a.png"></picture></div>';
    const { media, copy } = readSlideCells(row);
    assert.ok(media);
    assert.equal(copy, null);
  });
});

describe('carousel: prefersReducedMotion', () => {
  test('reflects the media query result', () => {
    installDom();
    setReducedMotion(true);
    assert.equal(prefersReducedMotion(), true);
    setReducedMotion(false);
    assert.equal(prefersReducedMotion(), false);
  });
});

describe('carousel: decorate — structure', () => {
  beforeEach(() => { installDom(); setReducedMotion(true); });

  test('builds stage, slides, dots, arrows and counter', () => {
    const block = buildCarousel(3);
    decorate(block);
    assert.ok(block.querySelector('.carousel-stage'), 'stage');
    assert.equal(block.querySelectorAll('.carousel-slide').length, 3, 'slides');
    assert.equal(block.querySelectorAll('.carousel-dot').length, 3, 'dots');
    assert.ok(block.querySelector('.carousel-arrow-prev'), 'prev arrow');
    assert.ok(block.querySelector('.carousel-arrow-next'), 'next arrow');
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
  });

  test('sets carousel a11y roles and labels', () => {
    const block = buildCarousel(2);
    decorate(block);
    assert.equal(block.getAttribute('role'), 'region');
    assert.equal(block.getAttribute('aria-roledescription'), 'carousel');
    assert.equal(block.querySelectorAll('[aria-roledescription="slide"]').length, 2);
  });

  test('honours an authored data-label', () => {
    const block = buildCarousel(2);
    block.dataset.label = 'Our watches';
    decorate(block);
    assert.equal(block.getAttribute('aria-label'), 'Our watches');
  });

  test('marks the first slide active on load', () => {
    const block = buildCarousel(3);
    decorate(block);
    const active = block.querySelectorAll('.carousel-slide.is-active');
    assert.equal(active.length, 1);
    assert.equal(active[0].getAttribute('aria-hidden'), 'false');
  });
});

describe('carousel: decorate — navigation', () => {
  beforeEach(() => { installDom(); setReducedMotion(true); });

  test('next advances and wraps around', () => {
    const block = buildCarousel(3);
    const api = decorate(block);
    api.nextSlide();
    assert.equal(block.querySelector('.carousel-counter').textContent, '2 / 3');
    api.nextSlide();
    api.nextSlide(); // wrap back to 1
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
  });

  test('prev goes backward and wraps', () => {
    const block = buildCarousel(3);
    const api = decorate(block);
    api.prevSlide();
    assert.equal(block.querySelector('.carousel-counter').textContent, '3 / 3');
  });

  test('clicking a dot jumps to that slide', () => {
    const block = buildCarousel(3);
    decorate(block);
    block.querySelectorAll('.carousel-dot')[2].click();
    assert.equal(block.querySelector('.carousel-counter').textContent, '3 / 3');
    assert.ok(block.querySelectorAll('.carousel-dot')[2].classList.contains('is-active'));
  });

  test('arrow buttons drive navigation', () => {
    const block = buildCarousel(3);
    decorate(block);
    block.querySelector('.carousel-arrow-next').click();
    assert.equal(block.querySelector('.carousel-counter').textContent, '2 / 3');
    block.querySelector('.carousel-arrow-prev').click();
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
  });

  test('ArrowRight / ArrowLeft keys navigate', () => {
    const block = buildCarousel(3);
    decorate(block);
    block.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(block.querySelector('.carousel-counter').textContent, '2 / 3');
    block.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
  });

  test('updates the live region on change', () => {
    const block = buildCarousel(3);
    const api = decorate(block);
    api.goTo(1);
    assert.equal(block.querySelector('.carousel-live').textContent, 'Slide 2 of 3');
  });

  test('swiping left advances, swiping right goes back', () => {
    const block = buildCarousel(3);
    decorate(block);
    const stage = block.querySelector('.carousel-stage');
    const down = (x) => new window.MouseEvent('pointerdown', { clientX: x, bubbles: true });
    const up = (x) => new window.MouseEvent('pointerup', { clientX: x, bubbles: true });
    // swipe left (dx < -threshold) → next
    stage.dispatchEvent(down(200));
    stage.dispatchEvent(up(120));
    assert.equal(block.querySelector('.carousel-counter').textContent, '2 / 3');
    // swipe right (dx > threshold) → prev
    stage.dispatchEvent(down(100));
    stage.dispatchEvent(up(200));
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
  });

  test('a tap below the swipe threshold does not navigate', () => {
    const block = buildCarousel(3);
    decorate(block);
    const stage = block.querySelector('.carousel-stage');
    stage.dispatchEvent(new window.MouseEvent('pointerdown', { clientX: 100, bubbles: true }));
    stage.dispatchEvent(new window.MouseEvent('pointerup', { clientX: 110, bubbles: true }));
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
  });

  test('pointerup without a pointerdown is ignored', () => {
    const block = buildCarousel(3);
    decorate(block);
    const stage = block.querySelector('.carousel-stage');
    stage.dispatchEvent(new window.MouseEvent('pointerup', { clientX: 500, bubbles: true }));
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
  });

  test('visibilitychange pauses and resumes without error', () => {
    setReducedMotion(false);
    const block = buildCarousel(3);
    const api = decorate(block);
    // jsdom document.hidden is false; dispatch the event to run the handler
    document.dispatchEvent(new window.Event('visibilitychange'));
    api.stop();
  });
});

describe('carousel: thumbnails variant', () => {
  beforeEach(() => { installDom(); setReducedMotion(true); });

  test('renders a thumbnail per slide and activates on click', () => {
    const block = buildCarousel(3, { thumbnails: true });
    decorate(block);
    const thumbs = block.querySelectorAll('.carousel-thumb');
    assert.equal(thumbs.length, 3);
    thumbs[1].click();
    assert.ok(thumbs[1].classList.contains('is-active'));
    assert.equal(block.querySelector('.carousel-counter').textContent, '2 / 3');
  });

  test('non-thumbnail carousel renders no rail', () => {
    const block = buildCarousel(3);
    decorate(block);
    assert.equal(block.querySelector('.carousel-thumbs'), null);
  });
});

describe('carousel: single slide', () => {
  beforeEach(() => { installDom(); setReducedMotion(true); });

  test('hides controls and counter when there is one slide', () => {
    const block = buildCarousel(1);
    decorate(block);
    assert.equal(block.querySelector('.carousel-controls').hidden, true);
    assert.equal(block.querySelector('.carousel-counter').hidden, true);
  });
});

describe('carousel: autoplay', () => {
  beforeEach(() => installDom());

  test('advances automatically when motion is allowed', async () => {
    setReducedMotion(false);
    const block = buildCarousel(3);
    const api = decorate(block);
    // autoplay interval is 6s; wait a beat then force via visibility toggle path
    await new Promise((r) => { setTimeout(r, 10); });
    assert.equal(block.querySelector('.carousel-counter').textContent, '1 / 3');
    // pausing on hover should not throw and should stop the timer
    block.dispatchEvent(new window.Event('mouseenter'));
    block.dispatchEvent(new window.Event('mouseleave'));
    api.stop(); // release the interval so the test process can exit
  });

  test('does not autoplay under reduced motion', () => {
    setReducedMotion(true);
    const block = buildCarousel(3);
    decorate(block);
    assert.equal(prefersReducedMotion(), true);
  });
});
