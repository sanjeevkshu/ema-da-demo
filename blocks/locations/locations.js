import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('locations-card');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('locations-image');
    if (cells[1]) cells[1].classList.add('locations-name');
    if (cells[2]) cells[2].classList.add('locations-locale');
    if (cells[3]) cells[3].classList.add('locations-address');
    if (cells[4]) cells[4].classList.add('locations-phone');
  });
  block.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '500' }])));
}
