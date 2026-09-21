import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom, buildBlock } from './setup.js';

installDom();

// These blocks all share the "tag each row + its cells" decoration pattern.
const { default: decorateSchedule } = await import('../blocks/schedule/schedule.js');
const { default: decorateSpecs } = await import('../blocks/specs/specs.js');
const { default: decorateStats } = await import('../blocks/stats/stats.js');
const { default: decorateTimeline } = await import('../blocks/timeline/timeline.js');
const { default: decorateScenarios } = await import('../blocks/scenarios/scenarios.js');
const { default: decorateValuecards } = await import('../blocks/valuecards/valuecards.js');

describe('schedule', () => {
  beforeEach(() => installDom());
  test('tags rows and time/detail cells', () => {
    const block = buildBlock('schedule', [['<p>9:00</p>', '<p>Keynote</p>']]);
    decorateSchedule(block);
    assert.ok(block.querySelector('.schedule-item'));
    assert.ok(block.querySelector('.schedule-time'));
    assert.ok(block.querySelector('.schedule-detail'));
  });
  test('is defensive when the second cell is missing', () => {
    const block = buildBlock('schedule', [['<p>9:00</p>']]);
    decorateSchedule(block);
    assert.ok(block.querySelector('.schedule-time'));
    assert.equal(block.querySelector('.schedule-detail'), null);
  });
});

describe('specs', () => {
  beforeEach(() => installDom());
  test('tags label and value cells', () => {
    const block = buildBlock('specs', [['<p>Battery</p>', '<p>7 days</p>']]);
    decorateSpecs(block);
    assert.ok(block.querySelector('.specs-item'));
    assert.ok(block.querySelector('.specs-label'));
    assert.ok(block.querySelector('.specs-value'));
  });
});

describe('stats', () => {
  beforeEach(() => installDom());
  test('tags number and label cells across multiple rows', () => {
    const block = buildBlock('stats', [
      ['<p>10k</p>', '<p>Users</p>'],
      ['<p>4.8</p>', '<p>Rating</p>'],
    ]);
    decorateStats(block);
    assert.equal(block.querySelectorAll('.stats-item').length, 2);
    assert.equal(block.querySelectorAll('.stats-number').length, 2);
    assert.equal(block.querySelectorAll('.stats-label').length, 2);
  });
});

describe('timeline', () => {
  beforeEach(() => installDom());
  test('tags year/title/body cells', () => {
    const block = buildBlock('timeline', [['<p>2024</p>', '<p>Launch</p>', '<p>Body</p>']]);
    decorateTimeline(block);
    assert.ok(block.querySelector('.timeline-card'));
    assert.ok(block.querySelector('.timeline-year'));
    assert.ok(block.querySelector('.timeline-title'));
    assert.ok(block.querySelector('.timeline-body'));
  });
});

describe('scenarios', () => {
  beforeEach(() => installDom());
  test('tags index/title/body/cta cells', () => {
    const block = buildBlock('scenarios', [[
      '<p>01</p>', '<p>Fitness</p>', '<p>Body</p>', '<p><a href="/">Go</a></p>',
    ]]);
    decorateScenarios(block);
    assert.ok(block.querySelector('.scenarios-card'));
    assert.ok(block.querySelector('.scenarios-index'));
    assert.ok(block.querySelector('.scenarios-title'));
    assert.ok(block.querySelector('.scenarios-body'));
    assert.ok(block.querySelector('.scenarios-cta'));
  });
});

describe('valuecards', () => {
  beforeEach(() => installDom());
  test('tags icon/title/body cells', () => {
    const block = buildBlock('valuecards', [['<p>⚡</p>', '<p>Fast</p>', '<p>Body</p>']]);
    decorateValuecards(block);
    assert.ok(block.querySelector('.valuecards-card'));
    assert.ok(block.querySelector('.valuecards-icon'));
    assert.ok(block.querySelector('.valuecards-title'));
    assert.ok(block.querySelector('.valuecards-body'));
  });
});
