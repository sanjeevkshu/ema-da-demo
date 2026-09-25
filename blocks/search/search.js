import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Site search over the query index (/query-index.json, see
 * reference/site-config/query.yaml). A plain GET form, so ?q= works without
 * JS; with JS, results filter as you type and the count is announced once
 * through a polite status region (not the whole list).
 *
 * Content model: one optional cell holding a link to another index.
 */

export const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;
const WEIGHTS = {
  title: 10, headings: 5, description: 3, path: 1,
};
const indexCache = new Map();

export function fetchIndex(source) {
  if (!indexCache.has(source)) {
    const load = fetch(source)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => (Array.isArray(json.data) ? json.data : []))
      .catch(() => []);
    indexCache.set(source, load);
  }
  return indexCache.get(source);
}

export function clearIndexCache() {
  indexCache.clear();
}

export function toTerms(query) {
  return [...new Set(String(query).toLowerCase().split(/\s+/).filter(Boolean))];
}

/** The index stores arrays as JSON strings on some paths; accept both. */
export function toList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [String(value)];
  } catch {
    return [String(value)];
  }
}

/** 0 unless every term matches somewhere; title hits outrank the rest. */
export function scoreRow(row, terms) {
  const fields = {
    title: (row.title || '').toLowerCase(),
    headings: toList(row.headings).join(' ').toLowerCase(),
    description: (row.description || '').toLowerCase(),
    path: (row.path || '').toLowerCase(),
  };
  let total = 0;
  const allMatch = terms.every((term) => {
    const hits = Object.entries(fields).filter(([, text]) => text.includes(term));
    hits.forEach(([field]) => { total += WEIGHTS[field]; });
    return hits.length > 0;
  });
  return allMatch ? total : 0;
}

export function searchIndex(rows, query) {
  const terms = toTerms(query);
  if (!terms.length) return [];
  return rows
    .filter((row) => row.path && !/noindex/i.test(row.robots || ''))
    .map((row) => ({ row, score: scoreRow(row, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.row.title || '').localeCompare(b.row.title || ''))
    .map(({ row }) => row);
}

/** Text with each term wrapped in <mark>, built from nodes (no innerHTML). */
export function highlight(text, terms) {
  const fragment = document.createDocumentFragment();
  const source = String(text || '');
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) {
    fragment.append(source);
    return fragment;
  }
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  source.split(re).forEach((part, i) => {
    if (!part) return;
    if (i % 2) {
      const mark = document.createElement('mark');
      mark.textContent = part;
      fragment.append(mark);
    } else {
      fragment.append(part);
    }
  });
  return fragment;
}

function renderResult(row, terms) {
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'search-result';
  link.href = row.path;
  if (row.image) {
    const media = document.createElement('div');
    media.className = 'search-result-image';
    // decorative: the title inside the same link already names it
    media.append(createOptimizedPicture(row.image, '', false, [{ width: '240' }]));
    link.append(media);
  }
  const body = document.createElement('div');
  body.className = 'search-result-body';
  const title = document.createElement('h2');
  title.className = 'search-result-title';
  title.append(highlight(row.title || row.path, terms));
  body.append(title);
  if (row.description) {
    const description = document.createElement('p');
    description.className = 'search-result-description';
    description.append(highlight(row.description, terms));
    body.append(description);
  }
  link.append(body);
  li.append(link);
  return li;
}

export function statusText(count, query) {
  if (count === 0) return `No results for “${query}”. Try a product name such as Loop or Vision.`;
  return `${count} ${count === 1 ? 'result' : 'results'} for “${query}”`;
}

function buildForm(block) {
  const form = document.createElement('form');
  form.className = 'search-form';
  form.setAttribute('role', 'search');
  form.method = 'get';
  form.action = window.location.pathname;

  const id = `search-input-${document.querySelectorAll('.search-form').length + 1}`;
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = 'Search PULSE';

  const field = document.createElement('div');
  field.className = 'search-field';
  const input = document.createElement('input');
  input.type = 'search';
  input.id = id;
  input.name = 'q';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('enterkeyhint', 'search');
  input.placeholder = 'Products, pages, features';
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Search';
  field.append(input, button);

  form.append(label, field);
  block.append(form);
  return { form, input };
}

export default function decorate(block) {
  const source = block.querySelector('a[href]')?.getAttribute('href') || '/query-index.json';
  block.textContent = '';

  const { form, input } = buildForm(block);
  const status = document.createElement('p');
  status.className = 'search-status';
  status.setAttribute('role', 'status');
  const results = document.createElement('ul');
  results.className = 'search-results';
  block.append(status, results);

  let timer;
  let latest = 0;

  const run = async () => {
    const query = input.value.trim();
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);

    latest += 1;
    const ticket = latest;
    if (query.length < MIN_CHARS) {
      results.replaceChildren();
      status.textContent = '';
      return;
    }
    const rows = await fetchIndex(source);
    if (ticket !== latest) return; // a newer keystroke won
    const hits = searchIndex(rows, query);
    const terms = toTerms(query);
    results.replaceChildren(...hits.map((row) => renderResult(row, terms)));
    status.textContent = statusText(hits.length, query);
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, DEBOUNCE_MS);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(timer);
    run();
  });
  // start loading the index as soon as the user shows intent
  input.addEventListener('focus', () => { fetchIndex(source); }, { once: true });

  const initial = new URLSearchParams(window.location.search).get('q');
  if (initial) {
    input.value = initial;
    return run();
  }
  return Promise.resolve();
}
