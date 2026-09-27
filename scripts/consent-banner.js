/*
 * The consent banner (opened by consent-check.js). Accept and Decline are
 * equally prominent: no pre-ticked choices, no hidden "reject", no nagging.
 * It doesn't take focus on first view (it isn't modal); when the visitor
 * reopens it from "Cookie settings", focus moves into it and returns after.
 */
import { loadCSS } from './aem.js';

export default function showBanner({
  current = null, reopened = false, onChoice = () => {}, doc = document,
} = {}) {
  if (!doc.querySelector('link[href$="/styles/consent-banner.css"]')) {
    loadCSS(`${window.hlx.codeBasePath}/styles/consent-banner.css`);
  }
  doc.querySelector('.consent-banner')?.remove();
  const returnFocus = reopened ? doc.activeElement : null;

  const banner = doc.createElement('div');
  banner.className = 'consent-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-modal', 'false');
  banner.setAttribute('aria-labelledby', 'consent-title');
  banner.setAttribute('aria-describedby', 'consent-text');
  banner.innerHTML = `
    <h2 id="consent-title">Cookies and Ask PULSE</h2>
    <p id="consent-text">Ask PULSE, our AI shopping assistant, is provided by Adobe and uses
      cookies to keep your conversation going. It only loads if you accept. The rest of the
      site works either way. <a href="/privacy">Privacy Policy</a></p>
    <p class="consent-current"></p>
    <div class="consent-actions">
      <button type="button" data-choice="declined">Decline</button>
      <button type="button" data-choice="accepted">Accept</button>
    </div>`;
  const status = banner.querySelector('.consent-current');
  if (current) status.textContent = `Your current choice: ${current === 'accepted' ? 'accepted' : 'declined'}.`;
  else status.remove();

  const close = () => {
    banner.remove();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  };
  banner.querySelectorAll('button[data-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      onChoice(button.dataset.choice);
      close();
    });
  });
  // Escape only dismisses a reopened banner; a first-time visitor must choose
  // (or simply ignore it: nothing optional loads until they do).
  banner.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reopened) close();
  });

  doc.body.append(banner);
  if (reopened) banner.querySelector('button[data-choice]').focus();
  return banner;
}
