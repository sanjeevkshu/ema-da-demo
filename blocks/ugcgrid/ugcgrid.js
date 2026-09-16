import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('ugcgrid-card');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('ugcgrid-image');
    if (cells[1]) cells[1].classList.add('ugcgrid-handle');
    if (cells[2]) cells[2].classList.add('ugcgrid-caption');
  });
  block.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }])));
}
