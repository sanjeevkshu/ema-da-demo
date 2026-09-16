export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('specs-item');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('specs-label');
    if (cells[1]) cells[1].classList.add('specs-value');
  });
}
