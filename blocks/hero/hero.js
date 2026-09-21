export default function decorate(block) {
  // Split hero: a single row with two cells (text + media).
  // Tag the cells so CSS can lay them out as two columns.
  if (block.classList.contains('split')) {
    const row = block.firstElementChild;
    if (row) {
      const cells = [...row.children];
      cells.forEach((cell) => {
        if (cell.querySelector('picture')) cell.classList.add('hero-media');
        else cell.classList.add('hero-text');
      });
    }
    return;
  }

  // Backdrop hero: a full-bleed image with the copy floated in a frosted
  // overlay card (Figma 55:2 / 64:25 — the landing "Your Life, Amplified"
  // treatment). Author a picture plus text in the block; JS promotes the
  // picture to the backdrop and wraps the remaining nodes in an overlay card.
  // Built in JS (not authored classes) so it survives the DA pipeline.
  if (block.classList.contains('backdrop')) {
    const picture = block.querySelector('picture');
    if (picture) {
      const media = document.createElement('div');
      media.className = 'hero-backdrop-media';
      // move the picture (and its wrapping <p>, if any) out to the backdrop
      const pictureHost = picture.closest('div > p') || picture;
      media.append(picture);
      if (pictureHost !== picture && pictureHost.parentElement && !pictureHost.textContent.trim()) {
        pictureHost.remove();
      }

      // collect the remaining text nodes into the overlay card
      const overlay = document.createElement('div');
      overlay.className = 'hero-overlay';
      const innerCell = block.querySelector(':scope > div > div') || block.querySelector(':scope > div');
      const source = innerCell || block;
      [...source.children].forEach((node) => {
        if (node.querySelector && node.querySelector('picture')) return;
        overlay.append(node);
      });

      block.textContent = '';
      block.append(media, overlay);
    }
  }
}
