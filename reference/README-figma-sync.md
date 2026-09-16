# PULSE — Figma → EDS sync

This project was migrated from Figma file **Agentic AI Delivery** (`dbJRnntnVQz6IEF1cqUGeA`) and is wired for repeatable, automated design updates.

## What's here

- `reference/design-tokens.json` — the extracted design system (colors, type scale, radii, spacing).
- `styles/pulse-tokens.css` — those tokens as CSS custom properties. **Every block consumes these**, so changing a token here re-themes the whole site.
- `reference/figma-sync.json` — the source-of-truth map: each **block** and **page** → its Figma node id.
- `reference/migration-plan.json` — page inventory with Figma node ids and responsive-variant node ids.

## How a future design update flows

1. **Token change in Figma** (e.g. brand blue shifts): re-read the design tokens and update `styles/pulse-tokens.css`. No block edits needed — all blocks reference the variables.
2. **Layout/content change on a page**: look up the page's `sourceNode` in `figma-sync.json`, re-run `get_design_context` on that node, and regenerate `content/<slug>.plain.html` (and download any new images to `content/images/<slug>/`).
3. **New block/section**: add a block under `blocks/`, register its Figma `sourceNode` in `figma-sync.json`.
4. Bump `lastSynced` in `figma-sync.json`.

## Pages (10)

PULSE brand pages: `know-the-brand`, `lifestyle-vision`, `contact`, `product-discovery`, `product-details`.
Wireframe-kit pages: `landing-page`, `about`, `article`, `shop`, `product-detail-page`.

Tablet/mobile Figma frames are folded into responsive CSS (`@media` breakpoints in each block), not separate pages.

## Custom blocks created

`stats`, `timeline`, `valuecards`, `scenarios`, `testimonials`, `schedule`, `ugcgrid`, `contactform`, `accordion`, `locations`, `productgrid`, `filterbar`, `newsletter`, `pdp`, `specs` — plus variants on existing `hero` (`split`, `center-hero`) and `columns` (`culture`, `schedule-layout`).

## Preview

Local dev server serves content under `/content/`: e.g. `http://localhost:3000/content/know-the-brand`.
Note: the server indexes content files at startup — restart it after adding new pages.

## Known limitations

- Figma **variables API** is not accessible with the current token scope (`file_variables:read` missing), so tokens are derived from computed frame styles rather than named variables. If that scope is granted, `get_variable_defs` would give exact named tokens.
- Decorative icon glyphs in `valuecards` use emoji stand-ins rather than the original Figma icon vectors.
