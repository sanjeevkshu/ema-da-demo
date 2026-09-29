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

/** Which icon a channel gets: a link is a community channel, else email or phone by its value. */
export function channelType(li) {
  const link = li.querySelector('a[href]');
  const href = link ? link.getAttribute('href') : '';
  const value = (li.querySelector('strong, a') || li).textContent;
  if (href.startsWith('mailto:') || (!link && value.includes('@'))) return 'mail';
  if (href.startsWith('tel:') || (!link && /\+?\d[\d\s().-]{5,}/.test(value))) return 'phone';
  return 'chat';
}

/**
 * Info cell: each channel in the list gets an icon tile, and a paragraph made
 * only of links (after the list) becomes the "follow" chips, with the
 * paragraph before it as their label.
 */
function decorateInfo(cell) {
  const list = cell.querySelector('ul');
  if (list) {
    list.classList.add('contactform-channels');
    [...list.children].forEach((li) => {
      li.classList.add('contactform-channel', `contactform-channel-${channelType(li)}`);
      const icon = document.createElement('span');
      icon.className = 'contactform-icon';
      icon.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'contactform-channel-text';
      text.append(...li.childNodes);
      li.append(icon, text);
    });
  }
  // only links, separated by whitespace (text nodes have no tagName)
  const linkOnly = (p) => !!p.querySelector('a') && [...p.childNodes].every(
    (n) => n.tagName === 'A' || (!n.tagName && !n.textContent.trim()),
  );
  let social = list && list.nextElementSibling;
  while (social && !(social.tagName === 'P' && linkOnly(social))) social = social.nextElementSibling;
  if (social) {
    social.classList.add('contactform-social');
    social.querySelectorAll('a').forEach((a) => a.classList.remove('button'));
    const label = social.previousElementSibling;
    if (label && label.tagName === 'P' && !linkOnly(label)) label.classList.add('contactform-social-label');
  }
}

export default function decorate(block) {
  // Single row, two cells: cell 0 = contact info (left), cell 1 = form (right).
  const row = block.firstElementChild;
  const cells = row ? [...row.children] : [];
  if (cells[0]) {
    cells[0].classList.add('contactform-info');
    decorateInfo(cells[0]);
  }
  if (cells[1]) {
    cells[1].classList.add('contactform-form');
    buildForm(cells[1]);
  }
}
