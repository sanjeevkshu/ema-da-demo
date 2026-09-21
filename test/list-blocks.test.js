import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  installDom, buildBlock, picture,
} from './setup.js';

installDom();

const { default: decorateCards } = await import('../blocks/cards/cards.js');
const { default: decorateProductgrid } = await import('../blocks/productgrid/productgrid.js');
const { default: decorateTestimonials } = await import('../blocks/testimonials/testimonials.js');
const { default: decorateUgcgrid } = await import('../blocks/ugcgrid/ugcgrid.js');
const { default: decorateLocations } = await import('../blocks/locations/locations.js');

describe('cards', () => {
  beforeEach(() => installDom());

  test('converts rows into a ul>li list with image/body cells', () => {
    const block = buildBlock('cards', [
      [picture('/c1.png', 'one'), '<p>Body one</p>'],
      [picture('/c2.png', 'two'), '<p>Body two</p>'],
    ]);
    decorateCards(block);
    assert.ok(block.querySelector('ul'));
    assert.equal(block.querySelectorAll('li').length, 2);
    assert.equal(block.querySelectorAll('.cards-card-image').length, 2);
    assert.equal(block.querySelectorAll('.cards-card-body').length, 2);
  });

  test('optimises pictures (webp source added)', () => {
    const block = buildBlock('cards', [[picture('/c1.png', 'one'), '<p>b</p>']]);
    decorateCards(block);
    assert.ok(block.querySelector('picture source[type="image/webp"]'));
  });
});

describe('productgrid', () => {
  beforeEach(() => installDom());

  test('builds cards and marks the first featured by default', () => {
    const block = buildBlock('productgrid', [
      [picture('/p1.png'), '<p>Arc</p>', '<p>$249</p>', '<p>Tagline</p>', '<p><a href="/">Buy</a></p>'],
      [picture('/p2.png'), '<p>Loop</p>', '<p>$199</p>', '<p>Tagline</p>', '<p><a href="/">Buy</a></p>'],
    ]);
    decorateProductgrid(block);
    assert.equal(block.querySelectorAll('.productgrid-card').length, 2);
    assert.ok(block.querySelector('.productgrid-image'));
    assert.ok(block.querySelector('.productgrid-price'));
    assert.ok(block.querySelector('.productgrid-btn'));
    assert.ok(block.querySelector('.productgrid-featured'));
    assert.equal(block.querySelectorAll('.productgrid-featured').length, 1);
  });

  test('related variant does not add a featured card', () => {
    const block = buildBlock('productgrid related', [
      [picture('/p1.png'), '<p>Arc</p>', '<p>$249</p>', '<p>t</p>', '<p><a href="/">Buy</a></p>'],
    ]);
    decorateProductgrid(block);
    assert.equal(block.querySelector('.productgrid-featured'), null);
  });
});

describe('testimonials', () => {
  beforeEach(() => installDom());

  test('tags quote and author cells', () => {
    const block = buildBlock('testimonials', [
      ['<p>"Great"</p>', '<p><strong>Ada</strong></p>'],
    ]);
    decorateTestimonials(block);
    assert.ok(block.querySelector('.testimonials-card'));
    assert.ok(block.querySelector('.testimonials-quote'));
    assert.ok(block.querySelector('.testimonials-author'));
  });

  test('tags an avatar picture when present', () => {
    const block = buildBlock('testimonials', [
      ['<p>"Great"</p>', `<div>${picture('/a.png', 'ada')}</div>`],
    ]);
    decorateTestimonials(block);
    assert.ok(block.querySelector('.testimonials-avatar'));
  });
});

describe('ugcgrid', () => {
  beforeEach(() => installDom());

  test('tags image/handle/caption and optimises pictures', () => {
    const block = buildBlock('ugcgrid', [
      [picture('/u.png', 'ugc'), '<p>@user</p>', '<p>caption</p>'],
    ]);
    decorateUgcgrid(block);
    assert.ok(block.querySelector('.ugcgrid-image'));
    assert.ok(block.querySelector('.ugcgrid-handle'));
    assert.ok(block.querySelector('.ugcgrid-caption'));
    assert.ok(block.querySelector('picture source[type="image/webp"]'));
  });
});

describe('locations', () => {
  beforeEach(() => installDom());

  test('tags all five location cells', () => {
    const block = buildBlock('locations', [[
      picture('/l.png', 'loc'), '<p>Lab</p>', '<p>Berlin</p>', '<p>Street 1</p>', '<p>+49</p>',
    ]]);
    decorateLocations(block);
    assert.ok(block.querySelector('.locations-card'));
    assert.ok(block.querySelector('.locations-image'));
    assert.ok(block.querySelector('.locations-name'));
    assert.ok(block.querySelector('.locations-locale'));
    assert.ok(block.querySelector('.locations-address'));
    assert.ok(block.querySelector('.locations-phone'));
  });
});
