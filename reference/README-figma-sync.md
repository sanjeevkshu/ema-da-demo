# PULSE — Figma → EDS sync

This project was migrated from Figma file **Agentic AI Delivery** (`dbJRnntnVQz6IEF1cqUGeA`) and is wired for repeatable, automated design updates.

## What's here

- `reference/design-tokens.json` — the extracted design system (colors, type scale, radii, spacing).
- `styles/pulse-tokens.css` — those tokens as CSS custom properties. **Every block consumes these**, so changing a token here re-themes the whole site.
- `reference/figma-sync.json` — the source-of-truth map: each **block** and **page** → its Figma node id.
- `reference/migration-plan.json` — page inventory with Figma node ids and responsive-variant node ids.

## How a future design update flows

1. **Token change in Figma** (e.g. brand blue shifts): re-read the design tokens and update `styles/pulse-tokens.css`. No block edits needed — all blocks reference the variables.
2. **Layout/content change on a page**: look up the page's `sourceNode` in `figma-sync.json`, re-run `get_design_context` on that node, and regenerate `content/<slug>.plain.html`. Put new images in `content/media-da/<slug>/`.
3. **New block/section**: add a block under `blocks/` with tests (≥80% coverage, see `testing-and-coverage.md`), then register its Figma `sourceNode` in `figma-sync.json`.
4. Bump `lastSynced` in `figma-sync.json`.
5. Publish through DA with the `da-publish` skill. Do the final check on the published site, not locally.

## Reading Figma frames

- **Frames can come back flattened.** The landing "Hero Carousel" stage (`55:2`) exported as a single bitmap with the overlay card baked in. The PDP frame (`59:14`) kept its layers: slide, copy overlay, controls, thumbnail rail. Read the least-flattened frame to get the interaction spec, and use `get_metadata` to find it.
- **Don't use frame exports as slide backgrounds.** Their text and controls are part of the pixels. Use clean product or lifestyle images from `content/media-da/`.
- **Tablet and mobile frames** (`64:*`) are layout references only. They fold into `@media` rules, not separate pages.

## Pages (15)

Home: `index` (served at `/`, PULSE brand).
PULSE brand pages: `know-the-brand`, `lifestyle-vision`, `contact`, `product-discovery`, `product-details`.
Hero Carousel pages: `discover` (landing), plus the PDPs `pulse-vision-ar`, `pulse-loop` and `pulse-band-neo`.
Wireframe-kit pages: `landing-page`, `about`, `article`, `shop`, `product-detail-page`.

Tablet/mobile Figma frames are folded into responsive CSS (`@media` breakpoints in each block), not separate pages.

## Custom blocks created

`carousel` (plus the `thumbnails` variant), `stats`, `timeline`, `valuecards`, `scenarios`, `testimonials`, `schedule`, `ugcgrid`, `contactform`, `accordion`, `locations`, `productgrid`, `filterbar`, `newsletter`, `pdp`, `specs`. Variants on existing blocks: `hero` (`split`, `center-hero`, `backdrop`) and `columns` (`culture`, `schedule-layout`).

## Preview

Local dev server serves pages at `/content/<slug>` with no extension, e.g. `http://localhost:3000/content/know-the-brand`. New pages render without a restart.
Local preview can't confirm nav/footer edits; see `da-authoring-rules.md` → "Local preview limits".

## Known limitations

- Figma **variables API** is not accessible with the current token scope (`file_variables:read` missing), so tokens are derived from computed frame styles rather than named variables. If that scope is granted, `get_variable_defs` would give exact named tokens.
- Decorative icon glyphs in `valuecards` use emoji stand-ins rather than the original Figma icon vectors.
