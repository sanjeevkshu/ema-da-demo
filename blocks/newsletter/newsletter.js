export default function decorate(block) {
  const rows = [...block.children];
  // row 0: text (heading + copy), row 1: form (email placeholder + submit label)
  if (rows[0]) rows[0].classList.add('newsletter-text');
  if (rows[1]) {
    rows[1].classList.add('newsletter-form');
    const inner = rows[1].querySelector('div') || rows[1];
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
