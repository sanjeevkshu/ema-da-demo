export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('stats-item');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('stats-number');
    if (cells[1]) cells[1].classList.add('stats-label');
  });
}
