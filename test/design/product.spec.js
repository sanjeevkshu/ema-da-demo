/*
 * @product — every product card and product page tells the truth, as defined
 * by the product catalog (reference/brand-concierge/product-catalog.csv, also
 * the concierge's catalog) and the approved images (reference/design/product-media.json):
 *   - a card shows the product's catalog image, alt text naming the product,
 *     the catalog price, and links to the product's page
 *   - a product page's heading and price match the catalog, and every image
 *     in its gallery is approved for that product
 */
import { test, expect } from '@playwright/test';
import { readJSON, readText } from './helpers.js';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const mediaId = (url) => (String(url).match(/media_[0-9a-f]+/) || [null])[0];
const pathOf = (url) => new URL(url).pathname.replace(/\/$/, '') || '/';
const price = (text) => {
  const m = String(text).replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

const catalog = parseCsv(readText('reference/brand-concierge/product-catalog.csv'));
const { $comment, ...media } = readJSON('reference/design/product-media.json');
const byName = Object.fromEntries(catalog.map((p) => [p.name, p]));

test('@product every catalog product has an approved-image entry, and back', () => {
  expect(Object.keys(media).sort()).toEqual(Object.keys(byName).sort());
});

for (const product of catalog) {
  test(`@product ${product.name} page (${pathOf(product.page_url)}) matches the catalog`, async ({ page }) => {
    const res = await page.goto(`${pathOf(product.page_url)}?consent=decline`);
    expect(res.status(), 'product page responds').toBe(200);
    await page.waitForFunction(() => document.body.classList.contains('appear'));
    await page.waitForSelector('.pdp.block[data-block-status="loaded"], .carousel.block[data-block-status="loaded"]');
    const found = await page.evaluate(() => {
      const hero = document.querySelector('main .pdp, main .carousel');
      const h1 = document.querySelector('main h1');
      const priceEl = hero.querySelector('.pdp-price, .carousel-copy p strong:only-child');
      const imgs = [...hero.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt }));
      return { name: h1 && h1.textContent.trim(), price: priceEl && priceEl.textContent, imgs };
    });
    expect.soft(found.name, 'heading').toBe(product.name);
    expect.soft(price(found.price), 'price').toBe(Number(product.price_usd));
    const approved = new Set([mediaId(product.image_url), ...media[product.name].gallery]);
    const wrong = found.imgs.filter((i) => !approved.has(mediaId(i.src))).map((i) => `${mediaId(i.src)} "${i.alt}"`);
    expect.soft(wrong, `images not approved for ${product.name}`).toEqual([]);
  });
}

test('@product every product card on every page matches the catalog', async ({ page, request }) => {
  test.setTimeout(300000);
  const index = await (await request.get('/query-index.json')).json();
  const problems = [];
  for (const { path } of index.data) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`${path}?consent=decline`);
    // eslint-disable-next-line no-await-in-loop
    const cards = await page.evaluate(async () => {
      const grids = [...document.querySelectorAll('main .productgrid')];
      if (!grids.length) return [];
      for (let i = 0; i < 50 && grids.some((g) => g.dataset.blockStatus !== 'loaded'); i += 1) {
        grids.forEach((g) => g.scrollIntoView());
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => { setTimeout(r, 200); });
      }
      return [...document.querySelectorAll('main .productgrid-card')].map((c) => {
        const img = c.querySelector('img');
        const link = c.querySelector('a[href]');
        return {
          name: (c.querySelector('.productgrid-name') || {}).textContent?.trim(),
          price: (c.querySelector('.productgrid-price') || {}).textContent,
          src: img && (img.currentSrc || img.src),
          alt: img && img.alt,
          href: link && link.href,
        };
      });
    });
    cards.forEach((card) => {
      const where = `${path}: card "${card.name}"`;
      const product = byName[card.name];
      if (!product) { problems.push(`${where} is not in the product catalog`); return; }
      if (mediaId(card.src) !== mediaId(product.image_url)) problems.push(`${where} shows ${mediaId(card.src)}, catalog image is ${mediaId(product.image_url)}`);
      if (!card.alt || !card.alt.toLowerCase().includes(product.name.toLowerCase())) problems.push(`${where} alt "${card.alt}" doesn't name the product`);
      if (price(card.price) !== Number(product.price_usd)) problems.push(`${where} price ${card.price} ≠ $${product.price_usd}`);
      if (!card.href || pathOf(card.href) !== pathOf(product.page_url)) problems.push(`${where} links to ${card.href && pathOf(card.href)}, not ${pathOf(product.page_url)}`);
    });
  }
  expect(problems, 'product cards out of line with the catalog').toEqual([]);
});
