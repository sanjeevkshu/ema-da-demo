export default function decorate(block) {
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const summary = cells[0];
    const body = cells[1];
    const details = document.createElement('details');
    details.className = 'accordion-item';
    const summaryEl = document.createElement('summary');
    summaryEl.className = 'accordion-summary';
    summaryEl.append(...summary.childNodes);
    details.append(summaryEl);
    if (body) {
      body.className = 'accordion-body';
      details.append(body);
    }
    row.replaceWith(details);
  });
}
