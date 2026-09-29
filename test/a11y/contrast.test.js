/*
 * Token contrast matrix, no browser (`npm run lint:a11y`): every colour pairing
 * in reference/design/contrast-pairs.json meets WCAG 2.2 AA, computed from the
 * design tokens (alpha composited over the background). A failing pair needs a
 * waiver (owner, reason, review date) until Figma and the tokens are fixed.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseColor } from '../design/static.mjs'; // eslint-disable-line import/extensions

const tokens = JSON.parse(readFileSync('reference/design-tokens.json', 'utf8')).base;
const { pairs, waivers } = JSON.parse(readFileSync('reference/design/contrast-pairs.json', 'utf8'));
const MIN = { text: 4.5, large: 3, ui: 3 };

const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** A translucent colour composited over an opaque one: [r, g, b]. */
const mixOver = ([r, g, b, a], [br, bgG, bb]) => [r * a + br * (1 - a), g * a + bgG * (1 - a), b * a + bb * (1 - a)];

/** WCAG contrast of a (possibly translucent) foreground over an opaque background. */
function contrast(fg, bg) {
  const [l1, l2] = [luminance(mixOver(fg, bg)), luminance(bg)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('design token contrast (WCAG 2.2 AA)', () => {
  test('the maths matches known values', () => {
    assert.equal(contrast([0, 0, 0, 1], [255, 255, 255, 1]).toFixed(1), '21.0');
    assert.equal(contrast([255, 255, 255, 1], [255, 255, 255, 1]).toFixed(1), '1.0');
  });

  pairs.forEach(({
    fg, bg, over, kind, where,
  }) => {
    const key = `${fg} on ${bg} (${kind})`;
    test(`${key}: ${where}`, () => {
      assert.ok(tokens[fg] && tokens[bg], `tokens ${fg} and ${bg} exist`);
      let background = parseColor(tokens[bg]);
      if (background[3] < 1) {
        assert.ok(tokens[over], `translucent background ${bg} names the surface it sits over`);
        background = [...mixOver(background, parseColor(tokens[over])), 1];
      }
      const ratio = contrast(parseColor(tokens[fg]), background);
      const waiver = waivers[key];
      if (waiver) {
        assert.ok(waiver.owner && waiver.reason && waiver.review, `waiver for ${key} names an owner, a reason and a review date`);
        assert.ok(new Date(waiver.review) >= new Date(new Date().toISOString().slice(0, 10)), `waiver for ${key} lapsed on ${waiver.review}: fix it or renew it in review`);
        assert.ok(ratio < MIN[kind], `${key} now passes (${ratio.toFixed(2)}:1): remove its waiver`);
        return;
      }
      assert.ok(ratio >= MIN[kind], `${key} is ${ratio.toFixed(2)}:1, needs ${MIN[kind]}:1 (${where})`);
    });
  });
});
