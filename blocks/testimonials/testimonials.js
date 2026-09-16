import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('testimonials-card');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('testimonials-quote');
    if (cells[1]) {
      cells[1].classList.add('testimonials-author');
      // if an avatar image is present, tag it
      const pic = cells[1].querySelector('picture');
      if (pic) pic.closest('div, p')?.classList.add('testimonials-avatar');
    }
  });
  block.querySelectorAll('picture > img').forEach((img) => img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '100' }])));
}
