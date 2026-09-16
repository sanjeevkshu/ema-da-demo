import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'productgrid-card';
    const cells = [...row.children];
    // cell 0: image, 1: name, 2: price, 3: tagline, 4: CTA link
    if (cells[0]) cells[0].classList.add('productgrid-image');
    if (cells[1]) cells[1].classList.add('productgrid-name');
    if (cells[2]) cells[2].classList.add('productgrid-price');
    if (cells[3]) cells[3].classList.add('productgrid-tagline');
    if (cells[4]) {
      cells[4].classList.add('productgrid-cta');
      const a = cells[4].querySelector('a');
      if (a) a.classList.add('productgrid-btn');
    }
    while (row.firstElementChild) li.append(row.firstElementChild);
    ul.append(li);
  });
  // first card is the featured (blue) variant — unless this is a related grid
  if (!block.classList.contains('related') && ul.firstElementChild) {
    ul.firstElementChild.classList.add('productgrid-featured');
  }
  ul.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '600' }])));
  block.replaceChildren(ul);
}
