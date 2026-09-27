/*
 * PULSE consent: one choice for the one optional feature that needs it, the
 * Ask PULSE assistant (Adobe Brand Concierge and its Web SDK cookies).
 *
 * - The choice is stored in localStorage ("pulse-consent"): a status, a version
 *   and a date, no personal data. Bump CONSENT_VERSION when the purposes
 *   change, and everyone is asked again.
 * - No choice yet: the banner (consent-banner.js) opens after page load, so it
 *   costs nothing on the critical path. The site works fully either way.
 * - Any link to #cookie-settings reopens the banner (the footer has one).
 * - ?consent=accept|decline overrides the stored choice for one page view
 *   (integration checks use it).
 * - Every change fires `consent.update` ({ detail: { consented } }). Accepting
 *   loads consented.js; features react to withdrawal themselves.
 */
export const CONSENT_KEY = 'pulse-consent';
export const CONSENT_VERSION = 1;
const STATES = ['accepted', 'declined'];

let consentedLoaded = false;

/** The stored choice ('accepted' | 'declined'), or null if none or outdated. */
export function readChoice(storage = window.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(CONSENT_KEY));
    return saved && saved.version === CONSENT_VERSION && STATES.includes(saved.status)
      ? saved.status : null;
  } catch {
    return null;
  }
}

export function saveChoice(status, storage = window.localStorage) {
  try {
    storage.setItem(CONSENT_KEY, JSON.stringify({
      status, version: CONSENT_VERSION, date: new Date().toISOString(),
    }));
  } catch {
    // storage blocked (private mode): the choice holds for this page view only
  }
}

/** ?consent=accept|decline for one page view, or null. */
export function queryOverride(search = window.location.search) {
  const value = new URLSearchParams(search).get('consent');
  if (value === null) return null;
  return ['accept', 'true', '1', 'yes'].includes(value.toLowerCase()) ? 'accepted' : 'declined';
}

/** Tells listeners about the choice and loads consented features on accept. */
export function applyChoice(status, win = window) {
  const consented = status === 'accepted';
  win.dispatchEvent(new win.CustomEvent('consent.update', { detail: { consented } }));
  if (consented && !consentedLoaded) {
    consentedLoaded = true;
    import('./consented.js');
  }
}

/** Saves and applies a choice made in the banner. */
export function choose(status, win = window) {
  saveChoice(status, win.localStorage);
  applyChoice(status, win);
}

/** Opens the banner; `reopened` means the visitor asked for it. */
export async function openBanner(reopened = false, win = window) {
  const { default: showBanner } = await import('./consent-banner.js');
  return showBanner({
    current: readChoice(win.localStorage),
    reopened,
    onChoice: (status) => choose(status, win),
  });
}

export function initConsent(win = window) {
  const choice = queryOverride(win.location.search) || readChoice(win.localStorage);
  if (choice) applyChoice(choice, win);
  else openBanner(false, win);

  win.document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href$="#cookie-settings"]');
    if (!link) return;
    e.preventDefault();
    openBanner(true, win);
  });
  win.pulseConsent = { open: () => openBanner(true, win), get: () => readChoice(win.localStorage) };
}

initConsent();
