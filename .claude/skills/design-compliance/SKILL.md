---
name: design-compliance
description: Keep PULSE's pages governed by the Figma design and the product catalog — the "Design (gate)" check on every PR. Use without being asked whenever a change touches a block's layout or CSS, adds a block, variant or page type, changes a product's image, price or page, or when the Figma file changes. Also use for "check design", "does this match Figma", "check Figma drift", "approve a Figma baseline", "promote a design check", "why did the Design gate fail", or when test/design-gate.test.js fails.
---

# Design compliance (sanjeevkshu / ema-da-demo)

Design is governed like code: DESIGN → BUILD → INTEGRATE → TEST → DEPLOY, with a
check at each PR. **Sources of truth:** Figma owns layout and style; DA owns
the words; the product catalog owns product images and prices.

| Source | File | Used by |
|---|---|---|
| Figma nodes per block and page, and reasons for anything without one | `reference/figma-sync.json` | coverage, drift |
| Design tokens (from Figma) | `reference/design-tokens.json` → `styles/pulse-tokens.css` | tokens |
| Measured block specs per breakpoint, from Figma | `reference/design/specs.json` | specs |
| Products: card image, price, page | `reference/brand-concierge/product-catalog.csv` (also the concierge's catalog) | product |
| Other approved images per product | `reference/design/product-media.json` | product |
| Levels per layer and destination | `reference/design/gate.config.json` | runner |
| Figma frame fingerprints at last sync | `reference/design/figma-fingerprints.json` | drift |
| Approved Figma frame exports | `reference/design/baselines/<page>-<width>.png` | visual-figma |

## The layers

| Layer | Proves | Where |
|---|---|---|
| tokens | Figma tokens equal the CSS tokens; colour and font-size literals never grow (ratchet in `css-baseline.json`); a media rule never re-lays-out an element that isn't the grid | `test/design/static.mjs` |
| responsive | Every page type at 390/768/1440: no sideways scroll, no clipped text, tap targets ≥24px (WCAG 2.2, with its spacing exception), no stretched images, one `<h1>` | `responsive.spec.js` |
| product | Every card shows its catalog image, alt naming the product, catalog price and link; product pages' heading, price and gallery images are approved | `product.spec.js` |
| specs | Measured columns, sizes, gaps and styles match Figma per breakpoint | `specs.spec.js` |
| coverage | Every block and page type has a Figma node or a recorded reason | `static.mjs` |
| visual-main | Before/after/diff screenshots against the PR's base branch, in the report artifact | `visual.spec.js` |
| visual-figma | Screenshot against the approved Figma export; skipped until a baseline exists | `visual.spec.js` |

`npm test` runs `test/design-gate.test.js` on every build: the config is valid,
**main is never looser than develop**, and the code-level layers pass.

## Levels and promotion

`off` → `report` (shows on the PR, never fails it) → `block`. Each layer has a
level for `develop`, `main` and `nightly`. At nightly, `block` turns the run red.

- Change levels only in a reviewed PR, and never make main looser than develop.
- Promote a layer after 3 green runs in a row.
- Promote a Figma page per destination: approve its baseline first (below), then add the slug to `visual-figma.promoted.<destination>` and to every higher destination.

## When you change something (no request needed)

| Change | Do |
|---|---|
| Block CSS/layout | Run the gate locally (below). If Figma defines the look, add or update the block's entry in `specs.json`, with values from `get_design_context` on its node |
| New block or variant | Map it in `figma-sync.json` `blocks` (node id) or `noDesign.blocks` (why), add a spec if it has a node, plus the library entry and unit tests |
| New page type | Map it in `figma-sync.json` `pages` or `noDesign.pages` |
| New or changed product, image or price | Update the catalog CSV (card image = `image_url`) and `product-media.json` (gallery images; `illustration` for stand-ins). Tell the user to re-upload the CSV in Composer |
| Removed colour/font literals | `node test/design/run.mjs --update-baseline` to lower the ratchet |
| Figma edited | Run the drift check; update specs, build and fingerprints in one PR |

## Run it

```sh
# all layers at a destination's levels, against a branch preview
DESIGN_BASE_URL=https://<branch>--ema-da-demo--sanjeevkshu.aem.page \
DESIGN_COMPARE_URL=https://develop--ema-da-demo--sanjeevkshu.aem.page \
npm run test:design -- --destination develop
# one layer
npx playwright test -c test/design/playwright.config.js --grep "@responsive "
```

Locally, the default browser build isn't installed. Use
`migration-work/probe/pw-design.config.js` with
`PWB=/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`,
and set `DESIGN_PW_CONFIG` and `DESIGN_RESULTS` to point the runner at it.

## Figma drift on demand

- **From the workspace, no token:** for each node that `mappedNodes()` in `test/design/drift.mjs` lists, call Figma MCP `get_metadata` with `maxDepth: 1`. Save each response to `migration-work/figma-meta/<id with - for :>.xml`, then run `node test/design/drift.mjs --from-metadata migration-work/figma-meta`. Add `--write` only after the sync is reviewed.
- **From GitHub:** Actions → "Design drift" → Run. It stays dormant until a `FIGMA_TOKEN` secret exists. Tick "export frames" to get PNGs of the page frames.
- **To approve a baseline:** review an exported PNG against the build, then commit it as `reference/design/baselines/<page>-1440.png`. The visual-figma layer picks it up. Tablet and phone need their own frames exported.

## Gotchas learned

- **Media rule on the wrong element.** `@media { .block { grid-template-columns } }` does nothing when the grid is on `.block > div`. This caused Contact's and the Products page's phone overflow. The tokens layer now flags it; use `minmax(0, 1fr)` columns.
- **The Figma frames at each breakpoint carry different copy** (emails, addresses, FAQs), and a frame can itself be broken (Contact desktop wraps per character). Treat frames as layout references. Send design defects to the designer; don't build them.
- **Designers re-wrap frames into sections**, which changes node IDs (23:3 → 49:2, 2:235 → 49:3). The drift check reports these as MISSING. Update `figma-sync.json` and `migration-plan.json` together.
- **Figma MCP output:** `get_design_context` gives exact CSS values plus asset URLs (valid for 14 days). `get_screenshot` only shows an image to the agent, so file baselines need the REST export.
- **Tap targets:** undersized links spaced ≥24px apart pass WCAG 2.5.8. Carousel dots at 8px apart don't; make the button 24px and draw the dot inside it.
- **DA image swaps:** DA source `<picture>` elements keep stale `/media-da` `<source>` paths. Rewrite the whole `<picture>` to a single `<img>`. Media IDs (`media_<hash>`) are the same on preview and live.
- **Content fixes ship through DA, not git.** Preview them with the PR; publish live after the code merges if the content depends on it.
