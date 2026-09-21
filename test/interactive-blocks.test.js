import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, buildBlock, picture } from './setup.js';

installDom();

const { default: decorateAccordion } = await import('../blocks/accordion/accordion.js');
const { default: decorateColumns } = await import('../blocks/columns/columns.js');
const { default: decorateNewsletter } = await import('../blocks/newsletter/newsletter.js');
const { default: decorateFilterbar } = await import('../blocks/filterbar/filterbar.js');
const { default: decoratePdp } = await import('../blocks/pdp/pdp.js');
const { default: decorateContactform } = await import('../blocks/contactform/contactform.js');

describe('accordion', () => {
  beforeEach(() => installDom());

  test('converts each row into a <details>/<summary>', () => {
    const block = buildBlock('accordion', [
      ['<p>Question 1</p>', '<p>Answer 1</p>'],
      ['<p>Question 2</p>', '<p>Answer 2</p>'],
    ]);
    decorateAccordion(block);
    assert.equal(block.querySelectorAll('details.accordion-item').length, 2);
    assert.equal(block.querySelectorAll('summary.accordion-summary').length, 2);
    assert.equal(block.querySelectorAll('.accordion-body').length, 2);
  });

  test('handles a summary-only row (no body cell)', () => {
    const block = buildBlock('accordion', [['<p>Q only</p>']]);
    decorateAccordion(block);
    assert.ok(block.querySelector('details'));
    assert.equal(block.querySelector('.accordion-body'), null);
  });
});

describe('columns', () => {
  beforeEach(() => installDom());

  test('adds a column-count class and tags image/text columns', () => {
    const block = buildBlock('columns', [[
      '<p>Text col</p>', `<div>${picture('/i.png', 'i')}</div>`,
    ]]);
    // the image lives in its own wrapper div (single child) → img-col
    // rebuild that cell so the picture is the sole child of a div
    const row = block.firstElementChild;
    const imgCell = row.children[1];
    imgCell.innerHTML = picture('/i.png', 'i');
    decorateColumns(block);
    assert.ok(block.classList.contains('columns-2-cols'));
    assert.ok(block.querySelector('.columns-text'));
    assert.ok(block.querySelector('.columns-img-col'));
  });

  test('text-only columns get the text class', () => {
    const block = buildBlock('columns', [['<p>A</p>', '<p>B</p>']]);
    decorateColumns(block);
    assert.equal(block.querySelectorAll('.columns-text').length, 2);
  });
});

describe('newsletter', () => {
  beforeEach(() => installDom());

  test('builds a form from the placeholder/label paragraphs', () => {
    const block = buildBlock('newsletter', [[
      '<h2>Join</h2><p>Copy</p>',
      '<p>you@mail.com</p><p>Subscribe</p>',
    ]]);
    decorateNewsletter(block);
    assert.ok(block.querySelector('.newsletter-text'));
    const form = block.querySelector('form.newsletter-form-el');
    assert.ok(form);
    assert.equal(form.querySelector('input').type, 'email');
    assert.equal(form.querySelector('input').placeholder, 'you@mail.com');
    assert.equal(form.querySelector('button').textContent, 'Subscribe');
  });

  test('submit is prevented (no navigation)', () => {
    const block = buildBlock('newsletter', [['<h2>Join</h2>', '<p>e</p><p>Go</p>']]);
    decorateNewsletter(block);
    const form = block.querySelector('form');
    const evt = new window.Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(evt);
    assert.equal(evt.defaultPrevented, true);
  });

  test('falls back to defaults when a cell is missing', () => {
    const block = buildBlock('newsletter', [['<h2>Join</h2>']]);
    decorateNewsletter(block);
    // only one cell → text tagged, no form built
    assert.ok(block.querySelector('.newsletter-text'));
    assert.equal(block.querySelector('form'), null);
  });

  test('uses default placeholder/label when the form cell has no paragraphs', () => {
    const block = buildBlock('newsletter', [['<h2>Join</h2>', '<h3>Sign up</h3>']]);
    decorateNewsletter(block);
    const input = block.querySelector('input');
    const btn = block.querySelector('button');
    assert.equal(input.placeholder, 'your@email.com');
    assert.equal(btn.textContent, 'Subscribe');
  });

  test('is a no-op when the block has no row', () => {
    const block = buildBlock('newsletter', []);
    decorateNewsletter(block);
    assert.equal(block.querySelector('form'), null);
  });
});

describe('filterbar', () => {
  beforeEach(() => installDom());

  test('tags pills + sort and marks the first pill active', () => {
    const block = buildBlock('filterbar', [[
      '<ul><li>All</li><li>Watches</li><li>Rings</li></ul>',
      '<p>Sort: Newest</p>',
    ]]);
    decorateFilterbar(block);
    assert.ok(block.querySelector('.filterbar-pills'));
    assert.ok(block.querySelector('.filterbar-sort'));
    assert.ok(block.querySelector('li.is-active'));
    assert.equal(block.querySelectorAll('li.is-active').length, 1);
  });

  test('is a no-op on an empty block', () => {
    const block = buildBlock('filterbar', []);
    decorateFilterbar(block);
    assert.equal(block.querySelector('.filterbar-pills'), null);
  });
});

describe('pdp', () => {
  beforeEach(() => installDom());

  function buildPdp() {
    return buildBlock('pdp', [[
      `${picture('/main.png', 'main')}${picture('/t1.png', 't1')}${picture('/t2.png', 't2')}`,
      '<h1>PULSE Arc</h1><p>$249</p><p>Great watch.</p>'
        + '<h3>Shell Size</h3><ul><li>40mm</li><li>44mm</li></ul>'
        + '<p><strong><a href="/">Add to Cart</a></strong></p>'
        + '<p>Free shipping.</p>',
    ]]);
  }

  test('builds gallery (main + thumbs) and details', () => {
    const block = buildPdp();
    decoratePdp(block);
    assert.ok(block.querySelector('.pdp-gallery'));
    assert.ok(block.querySelector('.pdp-main'));
    assert.equal(block.querySelectorAll('.pdp-thumb').length, 2);
    assert.ok(block.querySelector('.pdp-details'));
    assert.ok(block.querySelector('.pdp-price'));
    assert.ok(block.querySelector('.pdp-ship'));
  });

  test('size options are interactive (click toggles active)', () => {
    const block = buildPdp();
    decoratePdp(block);
    const sizes = block.querySelectorAll('.pdp-sizes li');
    assert.equal(sizes.length, 2);
    assert.ok(sizes[0].classList.contains('is-active'));
    sizes[1].click();
    assert.ok(sizes[1].classList.contains('is-active'));
    assert.equal(sizes[0].classList.contains('is-active'), false);
  });

  test('is a no-op with no row', () => {
    const block = buildBlock('pdp', []);
    decoratePdp(block);
    assert.equal(block.querySelector('.pdp-gallery'), null);
  });
});

describe('contactform', () => {
  beforeEach(() => installDom());

  test('builds a form with text, textarea and select fields', () => {
    const block = buildBlock('contactform', [[
      '<div><h3>Contact</h3><p>Reach us</p></div>',
      '<div><h3>Message us</h3>'
        + '<ul>'
        + '<li>Name | text | Your name</li>'
        + '<li>Message | textarea | Say hi</li>'
        + '<li>Topic | select | Sales, Support</li>'
        + '</ul>'
        + '<p>Send</p></div>',
    ]]);
    decorateContactform(block);
    assert.ok(block.querySelector('.contactform-info'));
    const form = block.querySelector('.contactform-form form');
    assert.ok(form);
    assert.equal(form.querySelectorAll('.contactform-field').length, 3);
    assert.ok(form.querySelector('input[type="text"]'));
    assert.ok(form.querySelector('textarea'));
    assert.equal(form.querySelectorAll('select option').length, 2);
    assert.equal(form.querySelector('button.contactform-submit').textContent, 'Send');
  });

  test('prevents submit navigation', () => {
    const block = buildBlock('contactform', [[
      '<div><p>info</p></div>',
      '<div><ul><li>Name | text</li></ul><p>Send</p></div>',
    ]]);
    decorateContactform(block);
    const form = block.querySelector('form');
    const evt = new window.Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(evt);
    assert.equal(evt.defaultPrevented, true);
  });

  test('defaults field type to text and submit label to Submit', () => {
    // no type given → text; no trailing <p> → default "Submit" label
    const block = buildBlock('contactform', [[
      '<div><p>info</p></div>',
      '<div><ul><li>Name</li></ul></div>',
    ]]);
    decorateContactform(block);
    const form = block.querySelector('form');
    assert.ok(form.querySelector('input[type="text"]'));
    assert.equal(form.querySelector('button').textContent, 'Submit');
  });

  test('handles a cell with no heading and no list', () => {
    const block = buildBlock('contactform', [[
      '<div><p>info</p></div>',
      '<div><p>Just send</p></div>',
    ]]);
    decorateContactform(block);
    // still produces a form with a submit button
    assert.ok(block.querySelector('.contactform-form form button'));
  });
});
