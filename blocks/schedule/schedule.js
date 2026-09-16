export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('schedule-item');
    const cells = [...row.children];
    if (cells[0]) cells[0].classList.add('schedule-time');
    if (cells[1]) cells[1].classList.add('schedule-detail');
  });
}
