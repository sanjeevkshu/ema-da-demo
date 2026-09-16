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
  }
}
