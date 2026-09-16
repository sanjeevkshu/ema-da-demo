# PULSE — Design-to-Build QA log

Systematic diff of the migrated build vs the Figma design, with measured
verification. Maintained during Phase 4 and any follow-up fixes.

## Method
- Measure rendered geometry/computed styles with Playwright `evaluate` against
  the **published** site (not just local — DA's pipeline strips inline classes
  and re-sections fragments, so local raw HTML can look correct while the
  published page differs).
- Compare against Figma frame screenshots + `get_metadata` dimensions.

## Findings & resolution

| # | Area | Design | Build issue | Fix | Verified |
|---|------|--------|-------------|-----|----------|
| 1 | Hero CTAs | 2 buttons side-by-side, 16px gap | Stacked (flex-column parent) | hero-text → block flow; adjacent `.button-wrapper` inline | ✅ both top:555 |
| 2 | Hero secondary button | white outline on dark | ink-colored, invisible | `.hero.split a.button.secondary` white border/text | ✅ |
| 3 | Footer columns | brand (wide) + 3 link cols | collapsed to 1 flat column (pipeline stripped wrapper divs) | footer.js rebuilds flat sequence into `.footer-columns` grid | ✅ 4 cols |
| 4 | Footer social | 4 circular icon chips | plain text links | `.footer-socials a` 40px circles w/ initial | ✅ radius 50% |
| 5 | Footer bottom bar | © left / DESIGNED right | stacked left | `.footer-bottom` flex space-between | ✅ 48 / 1042 |
| 6 | Button variants | primary/secondary/accent distinct | generic blue fill could win by source order | scope default fill to `:not(.secondary, .accent)` | ✅ |
| 7 | Section gutters | 48px | leftover boilerplate `padding: 0 32px` @≥900px | removed override | ✅ 48px |
| 8 | DA class stripping | n/a | inline `class=` on `<a>`/`<p>` dropped by pipeline | author buttons as `<strong>`/`<em>` links; derive block classes in JS | ✅ |

## Key lesson
**Verify on the published (DA) site, not only local `aem up`.** The pipeline:
- strips inline `class` attributes from authored content → use semantic markup
  (`<strong>`/`<em>` → buttons) and assign block classes in block JS;
- flattens structural wrapper `<div>`s in default content and may split a
  fragment into multiple sections → blocks (table markup) survive; default
  content does not, so structure-dependent blocks (footer) must rebuild from
  the flat node sequence in JS.

## Remaining watch-items
- Branch-host CDN caches CSS/JS aggressively; allow time or merge to main for a
  fresh build before final visual sign-off.
- `columns.culture` team photo occasionally appears blank in full-page
  screenshots (lazy-load timing) — confirmed present when scrolled into view.

## Full per-block scan (round 2) — findings

Systematic scan of all 5 PULSE pages surfaced these confirmed defects:

### High
- valuecards: icon tile (56x56 orange-tint bg, radius 12px) not rendering — glyph only.
- schedule (in columns.schedule-layout): time labels not orange/bold, titles not uppercase — block CSS not applying to nested structure.
- contactform: form card container (bg #f7f8fa, 2px #111827 border, radius 24px) entirely missing.
- hero badge (product-discovery "Drop 01 Out Now"): blue, should be orange pill.
- pdp ADD TO CART: renders black (#111827), should be blue (#1d4ed8).
- testimonials-as-reviews (product-details): spurious 2px border, white bg (should be #f7f8fa), reversed content order, stars grey (should be orange), no avatar.

### Medium
- Default-content section H2s render 44px (global) vs design 40px — applies to specs/reviews/related/locations/accordion headings.
- contactform info labels (#111827 full) should be muted ~60%.
- specs cards missing leading icon tile.
- productgrid.related cards white-on-surface blend (cards should be #fff on #f7f8fa section — actually build has surface cards on surface section).

### Low (cosmetic, deprioritized)
- eyebrow letter-spacing 1px vs ~2px; input/accordion border 1px vs 1.5px; ugcgrid card 10% vs 8%; various radius 8px vs 12px; newsletter input has border (design none); hero h1 64px vs ~48px on discovery.

## Round-2 resolutions (all verified via measured computed styles, local)

- valuecards icon tile: FALSE POSITIVE — tile renders correctly (56x56, orange-tint bg, orange glyph). Agent measured before block CSS applied.
- schedule time labels/titles: FIXED — nested block wasn't auto-decorating; styled raw structure in columns.schedule-layout CSS. Verified orange #f97316 / weight 800 / uppercase.
- contactform card: FIXED — card treatment moved onto <form> element. Verified surface bg, 2px ink border, 24px radius. Info labels muted 70%.
- hero badge (discovery): FIXED — `.hero.center-hero.drop` orange pill variant. Verified orange, radius 99px.
- pdp ADD TO CART: FIXED — forced blue in pdp.css. Verified rgb(29,78,216).
- testimonials.reviews (PDP): FIXED — variant with no border, surface bg, author-on-top (column-reverse), orange stars. Verified.
- section H2 40px: FIXED globally for section default-content headings.

### Deferred (low-severity cosmetic, documented not fixed)
- eyebrow letter-spacing 1px vs ~2px (sub-perceptible)
- input/accordion border 1px vs 1.5px
- ugcgrid card bg 10% vs 8%
- specs card leading icon tile (design has small icon; build omits) — would need icon assets
- discovery hero h1 64px vs ~48px; newsletter input has border vs none; assorted 8px vs 12px radii

### Architecture note learned
Nested blocks (a block authored inside another block's cell, e.g. `schedule` inside `columns`) are NOT auto-decorated by EDS — only top-level `main > .section > div > .block` blocks run their JS. Style nested structures via the parent block's CSS against the raw authored DOM, or invoke decoration manually.
