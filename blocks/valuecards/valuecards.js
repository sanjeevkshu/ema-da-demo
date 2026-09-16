export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('valuecards-card');
    const cells = [...row.children];
    // first cell holds the icon glyph (emoji/text), remaining are title/body
    if (cells[0]) cells[0].classList.add('valuecards-icon');
    if (cells[1]) cells[1].classList.add('valuecards-title');
    if (cells[2]) cells[2].classList.add('valuecards-body');
  });
}
