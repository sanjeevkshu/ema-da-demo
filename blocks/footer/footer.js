import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * Restructures the flat footer fragment content into the PULSE layout.
 *
 * The fragment authors the footer as default content, which the pipeline
 * flattens into a single sequence: brand logo, tagline, then repeating
 * "heading (p>strong) + link list (ul)" groups, a socials paragraph, and
 * finally the bottom-bar lines. This builds a columns row + bottom bar from
 * that sequence so the CSS grid has real column elements to target.
 */
function restructure(container) {
  // The fragment may arrive as multiple sections/wrappers; gather every
  // content node into one ordered sequence and rebuild from that.
  const wrappers = [...container.querySelectorAll('.default-content-wrapper')];
  const sourceEls = wrappers.length ? wrappers : [container];
  const nodes = [];
  sourceEls.forEach((w) => nodes.push(...w.children));
  if (!nodes.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'default-content-wrapper';

  const columnsRow = document.createElement('div');
  columnsRow.className = 'footer-columns';
  const bottomBar = document.createElement('div');
  bottomBar.className = 'footer-bottom';

  // The bottom bar is the run of trailing plain paragraphs (no links, no
  // <strong>) at the very end of the sequence — peel them off first so a
  // column's own body copy isn't mistaken for a bottom line.
  const isPlainPara = (n) => n && n.tagName === 'P' && !n.querySelector('a, strong');
  const bottomLines = [];
  while (nodes.length && isPlainPara(nodes[nodes.length - 1])) {
    bottomLines.unshift(nodes.pop());
  }

  const brandCol = document.createElement('div');
  brandCol.className = 'footer-col footer-col-brand';
  let currentCol = null;

  nodes.forEach((node) => {
    const heading = node.tagName === 'P' && node.querySelector('strong');
    if (heading) {
      // start a new link column
      currentCol = document.createElement('div');
      currentCol.className = 'footer-col';
      currentCol.append(node);
      columnsRow.append(currentCol);
    } else if (currentCol && (node.tagName === 'UL' || node.tagName === 'P')) {
      // list or paragraph belonging to the current column (links, copy, socials)
      if (node.tagName === 'P' && node.querySelectorAll('a').length > 1) {
        node.classList.add('footer-socials');
      }
      currentCol.append(node);
    } else {
      // pre-heading content → brand column (logo + tagline)
      brandCol.append(node);
    }
  });

  columnsRow.prepend(brandCol);
  bottomLines.forEach((l) => bottomBar.append(l));

  wrapper.replaceChildren(columnsRow, bottomBar);
  container.replaceChildren(wrapper);
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  restructure(footer);

  block.append(footer);
}
