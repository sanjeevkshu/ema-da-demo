---
name: design-compliance
description: Keep PULSE's pages governed by the Figma design system — design tokens, accessibility and layout — through the "Design (gate)" check on every PR, without slowing the build. Use without being asked whenever a change touches a block's layout or CSS, a design token, adds a block, variant or page type, or when the Figma file changes. Also use for "check design", "does this match Figma", "check Figma drift", "sync tokens", "approve a baseline", "promote a design check", "refresh the fixtures", "why did the Design gate fail", or when test/design-gate.test.js or test/a11y fails.
---

# Design compliance (sanjeevkshu / ema-da-demo)

Design is governed like code, and none of it slows the build or deploy:

- Code ships through AEM Code Sync on merge, not through CI.
- The critical path is the **Build** workflow (lint, headless a11y lint, token sync, unit tests; about 1 minute).
- Everything heavier runs in **`pr-quality.yaml`**, in parallel, folded into one required check: **"Design (gate)"**.

**Sources of truth:**
- **Figma** owns layout and style.
- **Copy and imagery belong to authoring** (DA) and are never design-gated.
- Checks run on **frozen fixture pages**, so any difference comes from code.

## Pipeline

| Stage | Where | Time | What |
|---|---|---|---|
| Build (critical path) | `main.yaml` | ~1 min | `lint` · `lint:a11y` (axe-core on every block's decorated example in jsdom, plus the token contrast matrix; no browser, ~4 s) · `tokens:check` · unit tests + coverage |
| Page checks | `pr-quality.yaml` → `design` ×3 widths in parallel | ~1–2 min each | tokens, fixtures, responsive, a11y (axe in headless Chromium), specs, coverage, visual-figma |
| Visual | `pr-quality.yaml` → `visual` | async | Applitools, **Layout** match (ignores copy and imagery), Ultrafast Grid at 390/768/1440, baselines per branch |
| Gate | `pr-quality.yaml` → `gate` | seconds | `test/design/aggregate.mjs`: skipped = pass; report-only layers warn |
| Nightly | `design.yaml` | — | the live real pages (`DESIGN_PAGES=live`) at the nightly levels |
| Tokens | `tokens-sync.yaml` | ~1 min | Tokens Studio push to `tokens/figma` → Style Dictionary → bot commit → PR into develop |
| Drift | `design-drift.yaml` | on demand | Figma frame fingerprints vs the last sync (needs `FIGMA_TOKEN`) |

Required checks on develop and main: **build** and **Design (gate)**.
Secrets:
- `APPLITOOLS_API_KEY` (the visual job skips without it, and on forked PRs)
- `FIGMA_TOKEN` (drift only)

## Sources and files

| What | File |
|---|---|
| Tokens (DTCG, from Tokens Studio) | `tokens/base.json`, `tokens/compact.json` (≤900px overrides), `tokens/$metadata.json` |
| Generated tokens (never hand-edit) | `styles/pulse-tokens.css`, `reference/design-tokens.json` via `tokens/build.mjs` |
| Levels per layer and destination | `reference/design/gate.config.json` |
| Frozen fixture pages | `reference/design/fixtures.json`; DA `/drafts/design-fixtures/<page>` (previewed, never published) |
| Contrast pairs and waivers | `reference/design/contrast-pairs.json` |
| Block specs from Figma | `reference/design/specs.json` |
| Figma map, and reasons for no design | `reference/figma-sync.json` |
| Literal ratchet, fingerprints, baselines | `reference/design/css-baseline.json`, `figma-fingerprints.json`, `baselines/` |
| Figma design-system brief | `reference/design/FIGMA-PROMPT.md` |

## Levels and promotion

`off` → `report` (visible, never fails) → `block`.
- The unit tests enforce three rules: **main is never looser than develop**, waivers carry an owner, a reason and a review date, and a lapsed waiver fails.
- Promote a layer after 3 green runs in a row.
- Promote `visual` once its Applitools baselines are approved.
- Promote a `visual-figma` page once its Figma export is committed to `baselines/` and the slug is added to every destination from the lowest one up.

## When you change something (no request needed)

| Change | Do |
|---|---|
| Block CSS or layout | Run the gate on the branch preview. If Figma defines the look, add or update the block's `specs.json` entry, with values from `get_design_context` |
| A token | Edit `tokens/*.json` (or let Tokens Studio push), `npm run tokens`, commit both generated files |
| New block or variant | Map it in `figma-sync.json` (or `noDesign` with a reason), add a spec, then `node test/a11y/fixtures.mjs` after the library build |
| New page type | Map it in `figma-sync.json`; create its fixture: copy the page's DA source to `/drafts/design-fixtures/<slug>`, preview it, add it to `fixtures.json`, then `run.mjs --update-fixtures` |
| New colour pairing | Add it to `contrast-pairs.json`. If it fails AA, fix it in Figma, or waive it (owner, reason, review) and raise it with design |
| Fewer literals | `node test/design/run.mjs --update-baseline` |
| Figma edited | Run the drift check; update specs, build and fingerprints in one PR |

## Run it locally

```sh
npm run lint:a11y && npm run tokens:check        # the critical-path additions
DESIGN_BASE_URL=https://<branch>--ema-da-demo--sanjeevkshu.aem.page \
  node test/design/run.mjs --destination develop --width 390
```

- The local browser build differs from the pinned one. Use `migration-work/probe/pw-design.config.js` with `PWB=/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`, and set `DESIGN_PW_CONFIG` and `DESIGN_RESULTS` to point at it.
- **Applitools:** `npm ci --prefix test/visual`, then `APPLITOOLS_API_KEY=… test/visual/node_modules/.bin/playwright test -c test/visual/playwright.config.js`.

## Figma drift on demand

- **Workspace, no token:** for every node that `mappedNodes()` in `test/design/drift.mjs` lists, call Figma MCP `get_metadata` with `maxDepth: 1`. Save each response to `migration-work/figma-meta/<id with - for :>.xml`, then run `node test/design/drift.mjs --from-metadata migration-work/figma-meta`. Add `--write` only after review.
- **GitHub:** Actions → "Design drift" → Run. Tick "export frames" for PNGs to approve as `baselines/<page>-1440.png`.

## Gotchas learned

- **A check that ran nothing must fail.**
  - A folder's `index` page is served at `/folder/`, not `/folder/index`, and it returned 404 while the layout checks "passed".
  - A layer-name pattern without digits silently dropped every `a11y` result.
  - `loadPage` now fails on any non-200 page, and the runner fails any enabled layer that runs zero tests.
- **Headless-lint scope.** jsdom has no layout, so contrast and target size can't be checked without a browser. The lint checks names, labels, roles and ARIA from real block code, and checks contrast at the token level. The rendered axe layer checks the rest. The lint found an unlabelled `<select>`; the rendered layer found focusable hidden carousel slides (fixed with `inert`) and colour-only links.
- **PULSE orange `#f97316` fails AA** on white, surface, blue and its own tint, and white-on-orange fails too. These are waived until 2026-10-31 and raised in the Figma prompt. A rendered contrast failure passes only when its exact colours are a waived token pair.
- **Isolate heavy tools.** Applitools pulls in about 176 MB, including browser drivers. It lives in `test/visual/` with its own lockfile, so `npm ci` on the critical path never installs it.
- **Tokens Studio emits `#FFFFFF` and `rgba()`.** `tokens/build.mjs` normalises colours to stylelint's notation. CSS variables don't work in media queries, so breakpoints are tokens enforced by the tokens layer.
- **Media rule on the wrong element.** `@media { .block { grid-template-columns } }` does nothing when the grid is on `.block > div`. This caused both phone overflows; the tokens layer flags it.
- **Figma frames at each breakpoint carry different copy, and frames get re-wrapped into sections** (their IDs change). Treat frames as layout references; drift reports them as MISSING.
- **Required checks with path filters stay pending forever.** Use one aggregator job with `if: always()` and treat skipped as a pass.
