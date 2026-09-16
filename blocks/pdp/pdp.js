import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * Product detail hero: gallery (main image + thumbnail row) on the left,
 * details panel (badges, title, price, description, color/size options,
 * add-to-cart, shipping note) on the right.
 *
 * Content model — two cells in one row:
 *   cell 0 (gallery): first <picture> = main image, following <picture>s = thumbnails
 *   cell 1 (details): bulleted meta then free content
 */
export default function decorate(block) {
  const row = block.firstElementChild;
  if (!row) return;
  const cells = [...row.children];
  const gallery = cells[0];
  const details = cells[1];

  if (gallery) {
    gallery.classList.add('pdp-gallery');
    const pics = [...gallery.querySelectorAll('picture')];
    const main = document.createElement('div');
    main.className = 'pdp-main';
    if (pics[0]) main.append(pics[0]);
    const thumbs = document.createElement('div');
    thumbs.className = 'pdp-thumbs';
    pics.slice(1).forEach((p, i) => {
      const t = document.createElement('div');
      t.className = 'pdp-thumb';
      if (i === 0) t.classList.add('is-active');
      t.append(p);
      thumbs.append(t);
    });
    gallery.replaceChildren(main, thumbs);
  }

  if (details) {
    details.classList.add('pdp-details');
    // tag price (first bare <p> right after the h1) and shipping note (last <p>).
    // DA strips authored classes, so derive these structurally.
    const h1 = details.querySelector('h1');
    if (h1) {
      const price = h1.nextElementSibling;
      if (price && price.tagName === 'P') price.classList.add('pdp-price');
      const desc = price && price.nextElementSibling;
      if (desc && desc.tagName === 'P') desc.classList.add('pdp-desc');
    }
    const paras = [...details.querySelectorAll(':scope > p')];
    const last = paras[paras.length - 1];
    // shipping note = last paragraph that isn't a decorated button wrapper
    if (last && !last.querySelector('a')) last.classList.add('pdp-ship');

    // interactive size buttons
    const sizeList = [...details.querySelectorAll('ul')].find((ul) => ul.previousElementSibling && /shell size/i.test(ul.previousElementSibling.textContent));
    if (sizeList) {
      sizeList.classList.add('pdp-sizes');
      const items = [...sizeList.children];
      if (items[0]) items[0].classList.add('is-active');
      items.forEach((li) => li.addEventListener('click', () => {
        items.forEach((x) => x.classList.remove('is-active'));
        li.classList.add('is-active');
      }));
    }
  }

  block.querySelectorAll('.pdp-main picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])));
  block.querySelectorAll('.pdp-thumb picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '300' }])));
}
