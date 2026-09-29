/*
 * Design gate, code-level layers (no browser):
 *   tokens    — reference/design-tokens.json (from Figma) and styles/pulse-tokens.css agree;
 *               colour and font-size literals outside the tokens never grow (ratchet);
 *               a media query never re-lays-out an element that isn't the grid (the
 *               Contact and newsletter phone-overflow bug)
 *   coverage  — every block and page type has a Figma source or a recorded reason not to
 *
 * Pure functions are exported for test/design-gate.test.js; run.mjs calls runStatic().
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

/** Any CSS colour literal to [r, g, b, a], or null. */
export function parseColor(value) {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = h.match(/../g).map((x) => parseInt(x, 16));
    return [n[0], n[1], n[2], n.length > 3 ? Math.round((n[3] / 255) * 100) / 100 : 1];
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  const alpha = parts[3] === undefined ? 1 : parts[3];
  const a = String(alpha).endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
  return [...parts.slice(0, 3).map(Number), Math.round(a * 100) / 100];
}

/** CSS without comments. */
export const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** [{ selectors, body, media }] for every rule, with media rules flattened one level. */
export function rules(css) {
  const out = [];
  const text = stripComments(css);
  const walk = (src, media) => {
    const re = /([^{}]+)\{/g;
    let m;
    re.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(src))) {
      const head = m[1].trim();
      let depth = 1;
      let j = re.lastIndex;
      for (; j < src.length && depth; j += 1) {
        if (src[j] === '{') depth += 1;
        if (src[j] === '}') depth -= 1;
      }
      const body = src.slice(re.lastIndex, j - 1);
      if (head.startsWith('@media')) walk(body, head);
      else if (!head.startsWith('@')) {
        out.push({ selectors: head.split(',').map((s) => s.trim()).filter(Boolean), body, media });
      }
      re.lastIndex = j;
    }
  };
  walk(text, null);
  return out;
}

/** Count colour literals and raw font sizes in a stylesheet. */
export function literalCounts(css) {
  const text = stripComments(css);
  const colors = (text.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) || []).length;
  const fontSizes = (text.match(/font-size\s*:\s*[^;}]+/gi) || [])
    .filter((d) => !/var\(|inherit|initial|unset|em\b|%|smaller|larger/.test(d)).length;
  return { colors, fontSizes };
}

/** Media rules that set grid columns on a selector no base rule makes a grid. */
export function orphanGridRules(css) {
  const all = rules(css);
  const grids = new Set(all.filter((r) => !r.media && /display\s*:\s*(inline-)?grid|grid-template-columns/.test(r.body))
    .flatMap((r) => r.selectors));
  return all.filter((r) => r.media && /grid-template-columns/.test(r.body))
    .flatMap((r) => r.selectors.filter((s) => !grids.has(s)).map((s) => `${r.media} { ${s} } sets columns, but no base rule makes "${s}" a grid`));
}

const cssFiles = (root) => [
  ...readdirSync(join(root, 'blocks')).flatMap((b) => (existsSync(join(root, 'blocks', b)) && !b.includes('.')
    ? readdirSync(join(root, 'blocks', b)).filter((f) => f.endsWith('.css')).map((f) => `blocks/${b}/${f}`) : [])),
  ...readdirSync(join(root, 'styles')).filter((f) => f.endsWith('.css')).map((f) => `styles/${f}`),
];

export function checkTokens(root = '.') {
  const problems = [];
  const notes = [];
  // 1. Figma tokens and the CSS custom properties agree
  const figma = json(join(root, 'reference/design-tokens.json')).colors;
  const tokensCss = read(join(root, 'styles/pulse-tokens.css'));
  Object.entries(figma).forEach(([name, value]) => {
    const m = tokensCss.match(new RegExp(`--pulse-${name}\\s*:\\s*([^;]+);`));
    if (!m) { problems.push(`colour "${name}" from Figma has no --pulse-${name} in styles/pulse-tokens.css`); return; }
    const a = parseColor(value);
    const b = parseColor(m[1]);
    if (!a || !b || a.some((x, i) => Math.abs(x - b[i]) > 0.01)) problems.push(`--pulse-${name} is ${m[1].trim()}, Figma says ${value}`);
  });
  // 2. literals outside the tokens file never grow
  const baselinePath = join(root, 'reference/design/css-baseline.json');
  const baseline = existsSync(baselinePath) ? json(baselinePath) : {};
  cssFiles(root).filter((f) => f !== 'styles/pulse-tokens.css').forEach((f) => {
    const now = literalCounts(read(join(root, f)));
    const was = baseline[f] || { colors: 0, fontSizes: 0 };
    ['colors', 'fontSizes'].forEach((k) => {
      if (now[k] > was[k]) problems.push(`${f}: ${now[k]} ${k === 'colors' ? 'colour literals' : 'raw font sizes'} (allowed ${was[k]}); use the --pulse-* tokens`);
      else if (now[k] < was[k]) notes.push(`${f}: ${k} down from ${was[k]} to ${now[k]}; lower the baseline (node test/design/run.mjs --update-baseline)`);
    });
    orphanGridRules(read(join(root, f))).forEach((o) => problems.push(`${f}: ${o}`));
  });
  return { problems, notes };
}

export function checkCoverage(root = '.') {
  const problems = [];
  const notes = [];
  const sync = json(join(root, 'reference/figma-sync.json'));
  const noDesign = sync.noDesign || { blocks: {}, pages: {} };
  const mapped = new Set(Object.keys(sync.blocks).map((k) => k.split('.')[0]));
  const blocks = readdirSync(join(root, 'blocks')).filter((b) => !b.includes('.'));
  blocks.forEach((b) => {
    if (!mapped.has(b) && !noDesign.blocks[b]) problems.push(`block "${b}" has no Figma node in reference/figma-sync.json and no reason in noDesign.blocks`);
  });
  json(join(root, '.github/page-types.json')).forEach((t) => {
    t.pages.forEach((slug) => {
      if (!sync.pages[slug] && !noDesign.pages[slug]) problems.push(`page "${slug}" (${t.name}) has no Figma frame and no reason in noDesign.pages`);
    });
  });
  const { $comment, ...specs } = json(join(root, 'reference/design/specs.json'));
  Object.keys(specs).forEach((b) => { if (!blocks.includes(b)) problems.push(`specs.json names "${b}", which isn't a block`); });
  const noSpec = [...mapped].filter((b) => blocks.includes(b) && !specs[b]);
  if (noSpec.length) notes.push(`mapped to Figma but no measured spec yet: ${noSpec.sort().join(', ')}`);
  return { problems, notes };
}

export function updateBaseline(root = '.') {
  const out = {};
  cssFiles(root).filter((f) => f !== 'styles/pulse-tokens.css').forEach((f) => {
    const c = literalCounts(read(join(root, f)));
    if (c.colors || c.fontSizes) out[f] = c;
  });
  return out;
}
