export default function decorate(block) {
  // Single row, two cells: cell 0 = text (heading + copy), cell 1 = form.
  const row = block.firstElementChild;
  const cells = row ? [...row.children] : [];
  if (cells[0]) cells[0].classList.add('newsletter-text');
  if (cells[1]) {
    cells[1].classList.add('newsletter-form');
    const inner = cells[1];
    const paras = inner.querySelectorAll('p');
    const placeholder = paras[0] ? paras[0].textContent.trim() : 'your@email.com';
    const submitLabel = paras[1] ? paras[1].textContent.trim() : 'Subscribe';
    const form = document.createElement('form');
    form.className = 'newsletter-form-el';
    form.addEventListener('submit', (e) => e.preventDefault());
    const input = document.createElement('input');
    input.type = 'email';
    input.placeholder = placeholder;
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = submitLabel;
    form.append(input, btn);
    inner.replaceChildren(form);
  }
}
