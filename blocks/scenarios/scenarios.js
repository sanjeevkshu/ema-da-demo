export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('scenarios-card');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('scenarios-index');
    if (cells[1]) cells[1].classList.add('scenarios-title');
    if (cells[2]) cells[2].classList.add('scenarios-body');
    if (cells[3]) cells[3].classList.add('scenarios-cta');
  });
}
