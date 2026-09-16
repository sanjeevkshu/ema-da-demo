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
