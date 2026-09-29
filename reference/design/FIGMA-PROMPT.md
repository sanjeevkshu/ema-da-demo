# PULSE design-system brief for Figma

Paste into Figma AI or Make, or hand to the designer. Every item is backed by a
measurement from the design gate (2026-09-29). When a gap is fixed, remove its
waiver in `contrast-pairs.json` or its note here.

```text
You are maintaining the PULSE brand design system (file "Agentic AI Delivery",
dbJRnntnVQz6IEF1cqUGeA). A code pipeline reads this file automatically:
Figma → Tokens Studio → GitHub (tokens/*.json, DTCG) → Style Dictionary → CSS.
Structure and naming matter as much as looks. Fix these gaps without changing
the visual direction, and list every change in a changelog.

1. ACCESSIBLE COLOUR (WCAG 2.2 AA; measured failures, all waived until 2026-10-31):
   - orange #F97316 on white 2.80:1, on surface #F7F8FA 2.63:1, on blue 2.39:1,
     on its own 10% tint 2.53:1; white on orange 2.80:1. Needed: 4.5:1 for text,
     3:1 for large text and UI.
   - blue #1D4ED8 on ink #111827 2.64:1 (hero accent word, 64px). Needed: 3:1.
   - ink at 50% on white 3.39:1 ("Follow for drops" label). Needed: 4.5:1.
   Keep #F97316 as the brand accent FILL, and add:
   - color/accent/text: an orange for text and icons on light backgrounds (≥4.5:1 on white and surface)
   - color/accent/on-dark: an orange or light variant for text on ink and blue (≥4.5:1)
   - color/on-accent: text on orange fills (ink passes; white does not)
   - color/action/on-dark: a lighter blue for text on ink (≥3:1 large, 4.5:1 body)
   - text/faint: ink 60% minimum for small text
   Annotate every text/background pair with its ratio.

2. VARIABLES (DTCG-friendly names, alias semantic → primitive, one "Light" mode,
   plus a "Compact" mode for widths ≤900px):
   - color/primitive and color/semantic (text/primary, muted 70%, subtle 60%,
     border/subtle 10%, bg/page, bg/surface, bg/inverse, on-inverse 80/70/50/10%)
   - type: family (Inter); sizes display 64 (compact 40), h2 40 (30), h3 24,
     lead 24 (18), card-title 22, body-lg 18, body 16, small 14, xsmall 12
   - weights: the code uses 400, 500, 600, 700, 800 AND 900. Choose a set
     (suggest 400/600/700/800) and say which 500/900 usages map to what.
   - line-heights: the code uses 1, 1.1, 1.2, 1.3, 1.5, 1.6 and 17px. Define
     tight/snug/body (+ display 77/48).
   - letter-spacing: 7 values in use (-1.28px, -1px, -0.96px, -0.5px, 0.04em,
     1px, 2px). Define heading-tight and eyebrow, one value each.
   - space 8/16/24/32/40/48 (+20 if intended; Contact uses it), section 96/112
     (compact 56/64), content max 1440, pad 48 (compact 24)
   - radius 6 (chip), 8, 12, 16, 20 (location card), 24, pill: confirm 6 and 20
   - shadow: 7 distinct shadows in use; define control, card, overlay only
   - border width 1 / 1.5 / 2; z-index layers (raised, controls, header,
     header-open, overlay: 8 raw values in use); motion 0.15s / 0.2s / 0.5s ease
   - size: tap-target 24 (min), comfortable 44, icon 22/24
   - breakpoints: the frames are 390/768/1440, the layout switches at 480, 600,
     700 and 900. Confirm the switch points and what changes at each.

3. RESPONSIVE FRAMES. Desktop, tablet and phone frames for each page, with the SAME
   placeholder copy (today's contact frames use three different emails, addresses
   and FAQs). Add phone frames for product-discovery and product-details. Fix
   contact-desktop "Contact-Info-Left": its auto-layout wraps the heading one or two
   letters per line.

4. MISSING TEMPLATES. Home, Accessory product page (PDP without a carousel), Legal
   page, Search results, consent banner, "Ask PULSE" chat launcher and panel.

5. COMPONENTS WITH STATES: button (primary, secondary, accent), input, select,
   textarea, chip, accordion item, carousel dot and arrow, product card, location
   card, contact channel row (44px icon tile). Each has default, hover,
   focus-visible (visible ring, ≥3:1), active, disabled and error. Carousel dots:
   24×24 hit area with the 8px dot centred. Links inside running text: underlined
   (not colour alone).

6. ICONS. Replace the emoji stand-ins (value cards) with an icon component set:
   mail, phone, chat, search, menu, close, chevron, plus, social (Instagram, TikTok,
   YouTube, Discord). 24px grid, 2px stroke.

7. STRUCTURE AND STABILITY. Mark heading levels (one H1 per page) and focus order
   on each template. Keep node IDs stable: don't re-wrap or duplicate frames that
   are already mapped (know-the-brand and lifestyle-vision became sections and
   changed IDs). Name frames "<page>-<desktop|tablet|mobile>" and sections by block
   name. Describe each published change in version history.

8. PUBLISH. Publish the variables and components as a library. Push tokens from
   Tokens Studio to the repo branch tokens/figma: tokens/base.json (Light) and
   tokens/compact.json (Compact overrides), DTCG format. Keep the token names that
   already exist (e.g. fs-h2, space-3, radius-md, ink-70) so the site keeps working.
```
