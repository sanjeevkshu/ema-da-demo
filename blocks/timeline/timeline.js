export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('timeline-card');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('timeline-year');
    if (cells[1]) cells[1].classList.add('timeline-title');
    if (cells[2]) cells[2].classList.add('timeline-body');
  });
}
