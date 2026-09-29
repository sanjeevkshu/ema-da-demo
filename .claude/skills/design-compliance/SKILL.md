---
name: design-compliance
description: Keep PULSE's pages governed by the Figma design system (design tokens, accessibility, layout, performance) through the "Design (gate)" check on every PR, without slowing the build. Use without being asked whenever a change touches a block's layout or CSS, a design token, adds a block, variant or page type, or when the Figma file changes. Also use for "check design", "does this match Figma", "check Figma drift", "sync tokens", "approve Applitools baselines", "promote a design check", "refresh the fixtures", "why did the Design gate fail", or when test/design-gate.test.js or test/a11y fails.
---

# Design compliance (sanjeevkshu / ema-da-demo)

Design is governed like code, and none of it slows the build or deploy:

- Code ships through AEM Code Sync on merge, not through CI.
- The critical path is the **Build** workflow (lint, headless a11y lint, token sync, unit tests with coverage; about 30 s).
- Everything slower runs in **`pr-quality.yaml`**, in parallel, folded into one required check: **"Design (gate)"**.
- **One bar for develop and main**, so nothing new fails at promotion.

**Sources of truth:**
- **Figma** owns layout and style.
- **Copy and imagery belong to authoring** (DA) and are never design-gated.
- PR checks run on **frozen fixture pages**, so every difference is code.

## Pipeline: where each check runs

| When | Workflow | What | Exit |
|---|---|---|---|
| Every push | `main.yaml` **Build** (critical path) | lint · `lint:a11y` (axe-core on every block's decorated example in jsdom, plus the token contrast matrix; no browser) · `tokens:check` · unit tests incl. code-level design checks (literal ratchet, breakpoints, grid rules, Figma coverage) · 80% per-file coverage for `blocks/` and `scripts/` | blocks |
| PR into develop or main | `pr-quality.yaml` → **Design (gate)** | `design` ×3 widths: fixtures, responsive, a11y (axe WCAG 2.2, headless Chromium), specs · `lighthouse` desktop + mobile on every fixture · `visual` Applitools · `security` dependency review | levels in `gate.config.json`; skipped = pass |
| PR | Adobe **aem-psi-check** | PageSpeed on the PR's preview link (needs the link in the PR body) | blocks |
| PR into main; into develop when integration files change | `integration.yaml` | full suite on main PRs; consent, search and fragments (no chats) on develop PRs | blocks |
| PR, main, weekly | `codeql.yaml` | SAST for JS and the workflows | code scanning |
| Push to main | `post-deploy.yaml` | aem.live serves the commit's code; smoke on aem.live and production | fail = roll forward or revert |
| Push to main | `experience-audit.yaml` | Lighthouse on live, mobile and desktop | report |
| Nightly | `design.yaml`, `integration.yaml` | live pages; design alerts raise one `design-nightly` issue | report / alert |
| Push to `tokens/figma` | `tokens-sync.yaml` | Tokens Studio → Style Dictionary → bot PR (GitHub App token, so the PR gets its checks) | — |
| On demand | `design-drift.yaml` | Figma frame fingerprints vs the last sync | — |

- **Required checks** on develop and main: **build**, **Design (gate)**, **aem-psi-check**; on main also **Integration (gate)**.
- **Secrets and variables:**
  - `APPLITOOLS_API_KEY` (the visual job skips without it, and on forks)
  - `vars.TOKENS_APP_ID` + `TOKENS_APP_PRIVATE_KEY` (token-sync bot)
  - `FIGMA_TOKEN` (drift)
- **Applitools prerequisite:** install the Applitools GitHub integration. Otherwise per-branch baselines never merge into develop or main, and every PR diffs against stale baselines.

## Files

| What | File |
|---|---|
| Tokens (DTCG, from Tokens Studio) | `tokens/base.json` (incl. Figma text styles as `typography` composites), `tokens/compact.json` (≤900px), `tokens/$metadata.json` |
| Generated tokens (never hand-edit) | `styles/pulse-tokens.css`, `reference/design-tokens.json` via `tokens/build.mjs` (`npm run tokens`) |
| Gate levels (one per layer) | `reference/design/gate.config.json` |
| Frozen fixtures | `reference/design/fixtures.json`; DA `/drafts/design-fixtures/<page>` (previewed, never published; a folder index is served at `/folder/`) |
| Contrast pairs and waivers | `reference/design/contrast-pairs.json` |
| Block specs from Figma | `reference/design/specs.json` |
| Figma map, and reasons for no design | `reference/figma-sync.json` |
| Literal ratchet, fingerprints | `reference/design/css-baseline.json`, `figma-fingerprints.json` |
| Figma design-system brief | `reference/design/FIGMA-PROMPT.md` |
| Lighthouse budgets | `.lighthouserc.json` (PR desktop), `.github/lighthouserc-mobile.json` (PR mobile: performance warns), `.github/lighthouserc-audit.json` (post-merge); reports go to the private artifact store, never public storage |

## Levels and promotion
`off` → `report` (visible, never fails) → `block`. There's one level per layer, the same for develop and main. The unit tests reject per-destination levels.

- Raise a level after **3 green runs in a row**, in a reviewed PR (CODEOWNERS requests the review).
- `visual`: raise it once its Applitools baselines are approved.
- Lighthouse mobile performance: move from `warn` to `error` after 3 green runs.
- Waivers carry an owner, a reason and a review date; a lapsed waiver fails the build.

## When you change something (no request needed)

| Change | Do |
|---|---|
| Block CSS or layout | Run the gate on the branch preview. If Figma defines the look, update `specs.json` with values from `get_design_context` |
| A token | Edit `tokens/*.json` (or let Tokens Studio push), `npm run tokens`, commit both generated files |
| New block or variant | Map it in `figma-sync.json` (or `noDesign` with a reason), add a spec, then `node test/a11y/fixtures.mjs` after the library build |
| New page type | Map it; copy the page's DA source to `/drafts/design-fixtures/<slug>`, preview it, add it to `fixtures.json`, run `run.mjs --update-fixtures` |
| New colour pairing | Add it to `contrast-pairs.json`; fix it in Figma, or waive it (owner, reason, review) |
| Fewer literals | `node test/design/run.mjs --update-baseline` |
| Figma edited | Run the drift check; update specs, build and fingerprints in one PR |

## Run it locally

```sh
npm run lint:a11y && npm run tokens:check && npm run test:coverage   # the critical path
DESIGN_BASE_URL=https://<branch>--ema-da-demo--sanjeevkshu.aem.page \
  node test/design/run.mjs --destination develop --width 390
migration-work/tools/actionlint .github/workflows/*.yaml             # after workflow edits
```

- The local browser build differs from the pinned one. Use `migration-work/probe/pw-design.config.js` with `PWB=/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`, and set `DESIGN_PW_CONFIG` and `DESIGN_RESULTS` to point at it.
- **Applitools:** `npm ci --prefix test/visual`, then `APPLITOOLS_API_KEY=… test/visual/node_modules/.bin/playwright test -c test/visual/playwright.config.js`.
- **Lint the way CI does:** CI has no `test/visual/node_modules`, so move it aside before running `npm run lint`.

## Figma drift on demand
- **Workspace, no token:** for every node that `mappedNodes()` in `test/design/drift.mjs` lists, call Figma MCP `get_metadata` with `maxDepth: 1`. Save each response to `migration-work/figma-meta/<id with - for :>.xml`, then run `node test/design/drift.mjs --from-metadata migration-work/figma-meta`. Add `--write` only after review.
- **GitHub:** Actions → "Design drift" → Run (needs `FIGMA_TOKEN`).

## Gotchas learned

- **A check that ran nothing must fail.**
  - A folder index URL returned 404 and "passed" layout checks.
  - A letters-only layer pattern dropped every `a11y` result.
  - `loadPage` now fails on non-200 pages, and the runner fails any enabled layer with zero tests.
- **Don't duplicate a check across stages.** Code-level design checks live in Build only; the gate runs browser layers only. A check asserted in `npm test` blocks every push, whatever the config says.
- **Stricter-at-main fails late.** The same bar on develop means a promotion PR finds nothing new; main adds only what can't run earlier (integration, post-deploy).
- **`GITHUB_TOKEN` pushes and PRs don't trigger workflows.** Bots that open PRs need a GitHub App token.
- **Headless lint scope.** jsdom has no layout, so contrast and target size need the browser layer. Token-level contrast catches brand issues without one.
- **PULSE orange `#f97316` fails AA** on white, surface, blue and its tint, and white-on-orange fails too. Waived until 2026-10-31 and raised in the Figma brief.
- **Isolate heavy tools.** Applitools (about 176 MB) has its own lockfile in `test/visual/`, so the build never installs it.
- **Tokens Studio emits `#FFFFFF` and `rgba()`.** The build normalises colours. CSS variables don't work in media queries, so breakpoints are tokens enforced in Build.
- **Media rule on the wrong element.** `@media { .block { grid-template-columns } }` does nothing when the grid is on `.block > div`; Build flags it.
- **Figma frames at each breakpoint carry different copy, and frames get re-wrapped into sections** (IDs change). Treat frames as layout references; drift reports them as MISSING.
- **Required checks with path filters stay pending forever.** Use one aggregator job with `if: always()`, and treat skipped as a pass.
- **Never upload Lighthouse reports to `temporary-public-storage`** for a pre-launch site.
