/*
 * Adobe Brand Concierge on the PULSE site (Web SDK + Brand Concierge Web Client).
 * Setup and go-live: reference/brand-concierge/INTEGRATION.md
 *
 * - Imported from consented.js, so nothing loads or reaches Adobe before consent.
 * - Adds a small "Ask PULSE" launcher on the surface pages only. The Web SDK and
 *   the Web Client (third-party, ~300 KB) load on the first open, so page load,
 *   LCP and INP don't pay for them.
 * - Off until ORG_ID and the datastream for the current environment are set.
 * - ?concierge=off skips it for one page view; ?concierge=debug turns on
 *   Web SDK debug logging (never on by default).
 */
import { loadCSS, loadScript } from './aem.js';

export const ALLOY_URL = 'https://cdn1.adoberesources.net/alloy/2.34.0/alloy.min.js';
export const WEB_CLIENT_URL = 'https://experience.adobe.net/solutions/experience-platform-brand-concierge-web-agent/static-assets/main.js';

export const CONFIG = {
  // IMS Org ID (Adobe Admin Console), e.g. '1234567890ABCDEF@AdobeOrg'
  orgId: '',
  // one datastream per environment: AEP > Data Collection > Datastreams
  datastreams: {
    dev: '', // *.aem.page and localhost (branch previews)
    stage: '', // *.aem.live (pre-launch site)
    prod: '', // production domain: pulse-portal-ivory.vercel.app
  },
  // conversation.region from the install snippet Composer generates
  region: 'va7',
  // keep in step with the surface rules in Composer; a trailing * matches a prefix
  paths: ['/', '/know-the-brand', '/lifestyle-vision', '/discover', '/product-discovery', '/product-details', '/pulse-*'],
  label: 'Ask PULSE',
};

export function environment(hostname) {
  if (hostname === 'localhost' || hostname.endsWith('.aem.page')) return 'dev';
  if (hostname.endsWith('.aem.live')) return 'stage';
  return 'prod';
}

export function isSurface(pathname, paths) {
  const path = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  return paths.some((p) => (p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p));
}

/** The settings for this page view, or null when the concierge shouldn't run. */
export function resolveConfig(location = window.location, config = CONFIG) {
  const mode = new URLSearchParams(location.search).get('concierge');
  if (mode === 'off') return null;
  const env = environment(location.hostname);
  const datastreamId = config.datastreams[env];
  if (!config.orgId || !datastreamId || !isSurface(location.pathname, config.paths)) return null;
  return {
    ...config, env, datastreamId, debug: mode === 'debug',
  };
}

/** Adobe's Web SDK base code (queues calls until alloy.min.js arrives). */
export function installAlloyStub(win = window) {
  if (win.alloy) return;
  // eslint-disable-next-line no-underscore-dangle
  win.__alloyNS = [...(win.__alloyNS || []), 'alloy'];
  const alloy = (...args) => new Promise((resolve, reject) => {
    alloy.q.push([resolve, reject, args]);
  });
  alloy.q = [];
  win.alloy = alloy;
}

export const OPT_OUT = { consent: [{ standard: 'Adobe', version: '1.0', value: { general: 'out' } }] };

/** Loads the Web SDK and the Web Client, then mounts the chat into `selector`. */
export async function startConcierge(cfg, selector, {
  win = window, load = loadScript, fetchImpl = fetch,
} = {}) {
  installAlloyStub(win);
  await load(ALLOY_URL);
  // the SDK logs its own failures (?concierge=debug); don't let them surface
  // as unhandled rejections
  const quiet = () => {};
  Promise.resolve(win.alloy('configure', {
    // loaded only after consent (consented.js); withdrawal opts out below
    defaultConsent: 'in',
    edgeDomain: 'edge.adobedc.net',
    edgeBasePath: 'ee',
    datastreamId: cfg.datastreamId,
    orgId: cfg.orgId,
    debugEnabled: cfg.debug,
    idMigrationEnabled: false,
    thirdPartyCookiesEnabled: false,
    conversation: { region: cfg.region },
    onBeforeEventSend: ({ xdm }) => {
      if (xdm.web && xdm.web.webPageDetails) xdm.web.webPageDetails.name = win.location.pathname;
      return true;
    },
  })).catch(quiet);
  Promise.resolve(win.alloy('sendEvent', {})).catch(quiet);
  win.addEventListener('consent.update', (e) => {
    if (e.detail && e.detail.consented === false) {
      Promise.resolve(win.alloy('setConsent', OPT_OUT)).catch(quiet);
    }
  });

  const [styles] = await Promise.all([
    fetchImpl(`${win.hlx.codeBasePath}/scripts/brand-concierge-styles.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
    load(WEB_CLIENT_URL),
  ]);
  win.adobe.concierge.bootstrap({
    instanceName: 'alloy',
    stylingConfigurations: styles,
    selector,
    stickySession: false,
  });
}

/** Adds the launcher and chat panel; the SDKs load on the first open. */
export function mountLauncher(cfg, { doc = document, start = startConcierge } = {}) {
  const launcher = doc.createElement('button');
  launcher.type = 'button';
  launcher.className = 'concierge-launcher';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'concierge-panel');
  launcher.textContent = cfg.label;

  const panel = doc.createElement('dialog');
  panel.id = 'concierge-panel';
  panel.className = 'concierge-panel';
  panel.setAttribute('aria-label', cfg.label);
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'concierge-close';
  close.setAttribute('aria-label', 'Close chat');
  close.textContent = '×';
  const mount = doc.createElement('div');
  mount.id = 'brand-concierge-mount';
  panel.append(close, mount);

  let started;
  const setOpen = (open) => {
    if (open) {
      panel.show();
      if (!started) {
        started = start(cfg, '#brand-concierge-mount').catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Brand Concierge failed to load', err);
          started = undefined;
        });
      }
    } else {
      panel.close();
    }
    launcher.setAttribute('aria-expanded', String(open));
    (open ? close : launcher).focus();
  };
  launcher.addEventListener('click', () => setOpen(!panel.open));
  close.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  });

  doc.body.append(launcher, panel);
  return { launcher, panel };
}

export default function init() {
  const cfg = resolveConfig();
  if (!cfg) return null;
  loadCSS(`${window.hlx.codeBasePath}/styles/brand-concierge.css`);
  return mountLauncher(cfg);
}
