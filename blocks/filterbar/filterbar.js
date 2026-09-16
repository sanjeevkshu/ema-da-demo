export default function decorate(block) {
  // Single row: cell 0 = filter pills (ul), cell 1 = sort label
  const row = block.firstElementChild;
  if (!row) return;
  const cells = [...row.children];
  if (cells[0]) {
    cells[0].classList.add('filterbar-pills');
    const items = cells[0].querySelectorAll('li');
    if (items[0]) items[0].classList.add('is-active');
  }
  if (cells[1]) cells[1].classList.add('filterbar-sort');
}
