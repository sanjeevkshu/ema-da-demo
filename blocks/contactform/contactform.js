/**
 * Turns the authored form cell into a real <form>. The cell contains a heading
 * followed by a list of field definitions ("Label | type" or "Label | select | opt1, opt2")
 * and a final submit label.
 */
function buildForm(cell) {
  const inner = cell.querySelector('div') || cell;
  const heading = inner.querySelector('h1, h2, h3, h4, h5, h6');
  const list = inner.querySelector('ul');
  const form = document.createElement('form');
  form.setAttribute('novalidate', '');
  form.addEventListener('submit', (e) => e.preventDefault());

  if (heading) form.append(heading);

  if (list) {
    [...list.children].forEach((li) => {
      const parts = li.textContent.split('|').map((s) => s.trim());
      const label = parts[0];
      const type = (parts[1] || 'text').toLowerCase();
      const field = document.createElement('div');
      field.className = 'contactform-field';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      field.append(lbl);
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (type === 'textarea') {
        const ta = document.createElement('textarea');
        ta.id = id; ta.rows = 4; ta.placeholder = parts[2] || '';
        field.append(ta);
      } else if (type === 'select') {
        const sel = document.createElement('select');
        sel.id = id;
        (parts[2] || '').split(',').map((o) => o.trim()).filter(Boolean).forEach((opt) => {
          const o = document.createElement('option');
          o.textContent = opt; sel.append(o);
        });
        field.append(sel);
      } else {
        const inp = document.createElement('input');
        inp.type = type; inp.id = id; inp.placeholder = parts[2] || '';
        field.append(inp);
      }
      form.append(field);
    });
    list.remove();
  }

  // submit button — use the last standalone paragraph/link as the label
  const submitP = [...inner.querySelectorAll('p')].pop();
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'contactform-submit';
  btn.textContent = submitP ? submitP.textContent.trim() : 'Submit';
  if (submitP) submitP.remove();
  form.append(btn);

  inner.replaceChildren(form);
}

export default function decorate(block) {
  // Single row, two cells: cell 0 = contact info (left), cell 1 = form (right).
  const row = block.firstElementChild;
  const cells = row ? [...row.children] : [];
  if (cells[0]) cells[0].classList.add('contactform-info');
  if (cells[1]) {
    cells[1].classList.add('contactform-form');
    buildForm(cells[1]);
  }
}
