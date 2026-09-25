# Brand Concierge inputs for PULSE

Review sheet for setting up Adobe Brand Concierge on the PULSE site. Composer
drafts most of this itself from the website URL. Use this sheet to check and
correct each draft before you save it. Everything here comes from the site's own
pages (September 2026). Items marked **Decide** need a brand or legal owner.

Sources: Adobe's Brand Concierge docs (`AdobeDocs/brand-concierge.en`):
*Manage a concierge*, *Knowledge sources*, *Evaluate a concierge*, *Deploy a
concierge*, *Developer and customization guide*, *Go-live checklist*.

Files in this folder:

| File | Use in Composer |
|---|---|
| `knowledge-source-urls.csv` | Knowledge source → Website Links → CSV upload |
| `product-catalog.csv` | Knowledge source → Product Catalog. Copy the columns into Adobe's sample sheet for the schema you pick. |
| `evaluation-set.csv` | Evaluations → manual or spreadsheet upload (functional, out of scope, safeguard) |

---

## 0. Fix these on the site before the first crawl

The concierge only answers from its knowledge sources. Where the site
contradicts itself, it repeats whichever page it read. Fix these first, or keep
the affected pages out of the knowledge source.

| # | Conflict | Where | Decide |
|---|---|---|---|
| 1 | **Shipping.** "Free express priority shipping. Ships within 24 hours." versus "Free shipping on all orders over $100." | Contact FAQ and PULSE Arc page, versus the Loop, Band Neo and Vision AR pages | One policy |
| 2 | **Returns.** "Returns accepted within 30 days on unworn devices in original packaging" versus "30-day money back guarantee" | Contact FAQ, versus product pages | One wording |
| 3 | **PULSE Arc Slim price.** $219 versus $229 | Products page, versus "Complete Your Setup" grids | One price |
| 4 | **PULSE Loop Gold price.** $229 versus $259 | Products page, versus "Complete Your Setup" grids | One price |
| 5 | **Product name.** The FAQ asks about "the Pulse Ring"; the product is **PULSE Loop** | Contact FAQ | Rename |
| 6 | **Breadcrumbs.** Loop (ring), Vision AR (glasses) and Band Neo sit under "Products > Smartwatches" | Product pages | Fix categories |
| 7 | **Placeholder pages** (lorem ipsum): `/about`, `/article`, `/landing-page`, `/shop`, `/product-detail-page` | Published, and in the sitemap | Unpublish, or add `robots: noindex` (that also drops them from the sitemap and search) |
| 8 | **Accessories with no page:** Arc Slim, Loop Gold, Charge Dock ($49), Loop Case ($29), Neo Straps ($19), Studio ($349) | "Complete Your Setup" grids only | Add pages, or accept mention-only |
| 9 | **Forms that don't submit:** "Launch Ticket" (Contact) and newsletter "Subscribe" | Contact, Products | Wire them up, or keep instruction I-6 below |
| 10 | **Typo:** "Three college drops out" → "dropouts" | Know the Brand timeline | Fix |

`CSV` upload (below) already leaves out the placeholder pages, so #7 doesn't
block the first crawl.

---

## 1. Brand expression (tone sliders)

Composer proposes these values from the site. Suggested settings:

| Attribute | Setting | Why (site evidence) |
|---|---|---|
| Formality | **Casual** (low) | "Sync in", "You dictate the wave", "goes hard" |
| Warmth | **Warm** (high) | Community-first: "Absolute Community", Discord votes on firmware |
| Playfulness | **Playful**, one step short of max | Streetwear voice, neon, slang. Keep policy answers straight. |
| Energy | **High** | "Wear the Future", "Defiant Innovation", drops that sell out in 4 minutes |
| Response length | **Short** | Mobile-first Gen Z audience: 2–4 sentences, then a link or card |

---

## 2. Brand profile

**Brand goal**
Tear down "sterile, gray medical tech": make biometric wearables that people
want to wear, as high-precision cyber-streetwear that tracks the body and makes
a fashion statement, co-designed with its community.

**Products and services**

| Product | Price | What it is | Page |
|---|---|---|---|
| PULSE Arc | $249 | Curved-screen smartwatch, 1.4" AMOLED 600 nit, 7-day battery, IP68, ECG and SpO2; 40 or 44 mm; Midnight | `/product-details` |
| PULSE Loop | $199 | Grade-5 titanium smart ring, 7-day battery, 100 m water rating, HRV, skin temp, SpO2, sleep stages; no screen | `/pulse-loop` |
| PULSE Band Neo | $129 | 19 g band, 1.1" AMOLED strip, 5-day battery, 5ATM; six neon strap finishes | `/pulse-band-neo` |
| PULSE Vision AR | $499 | 58 g titanium AR glasses, dual 4K micro-OLED, 12 h battery, ECG, SpO2, IP68 | `/pulse-vision-ar` |
| PULSE Arc Slim | $219 / $229 (**conflict #3**) | Thinner Arc, Midnight finish | none |
| PULSE Loop Gold | $229 / $259 (**conflict #4**) | Loop in brushed gold | none |
| Accessories | $19–$349 | Neo Straps 3-pack, Loop Case, Charge Dock, Studio desk hub | none |
| Services | none | Free shipping (**conflict #1**), 30-day returns (**#2**), trade-in for store credit, 50+ countries, PULSE app sync | `/contact`, `/know-the-brand` |

**Target audience**
Gen Z (the footer says it outright; reviewers are 21–27) who treat tech as
style. Personas from the Lifestyle page:
- athletes in heavy training (cadence, recovery, readiness)
- creatives: digital artists, music producers and DJs (focus, playlists, strap swaps for night)
- developers and "operators" under stress (breathing prompts, stress signals)
- the social crowd (tap-to-share, NFC contact drops)

**Brand values** (Know the Brand)
1. **Circular Sustainability:** 100% recycled aluminium bodies, and a trade-in for store credit any time.
2. **Defiant Innovation:** no 1% steps; fluid OS, hot-swap modular bands, AI skin sensors.
3. **Absolute Community:** Discord votes on firmware, colourways and drops.

**Key differentiators**
- Fashion-first design: cyber-streetwear, neon finishes, straps you can swap in seconds without tools.
- A full lineup (watch, band, ring and AR glasses) syncing to one PULSE app.
- A roadmap the community votes on.
- Long battery life: 7 days on Loop and Arc.
- Recycled materials plus trade-in.
- Scale: 500K+ members, 50+ countries, a 4.8 rating from 35,000+ App Store reviews. Quote only as stated.

**Common use cases**
1. "Which PULSE fits me?" (by activity: training, sleep, creative focus, nightlife)
2. Compare devices (battery, screen or no screen, water rating, sensors, price)
3. Specs lookup
4. Shipping, returns, international delivery
5. Strap swapping and customisation
6. Contact, collaborations, press, custom orders (email)
7. Labs and studios in New York, London and Berlin
8. Community: Discord, drops, newsletter

---

## 3. Concierge instructions

- **I-1 Trademarks.** Always write **PULSE** in capitals. Use the exact product names: PULSE Arc, PULSE Arc Slim, PULSE Band Neo, PULSE Loop, PULSE Loop Gold, PULSE Vision AR. Never say "Pulse Ring"; say PULSE Loop.
- **I-2 Structure.** Answer first in 1–2 sentences, then at most 3 short bullets, then one link or product card. No headings in answers.
- **I-3 Voice.** Casual and upbeat. Brand words ("vibe", "frequency", "sync") only lightly, and never in shipping, returns, pricing or health answers.
- **I-4 Recommendations.** Match the device to the activity. Training → Arc or Band Neo. Sleep and recovery with no screen → Loop. Hands-free data → Vision AR. Budget → Band Neo. Say why in one line.
- **I-5 Facts.** Give prices in USD exactly as the product page shows. If a figure isn't in the sources, say so and link the product page.
- **I-6 Contact.** For orders, tickets, collaborations, press or custom orders, give **hello@pulsewear.com** and **+1 (555) 234-PULS**. Don't say a form was submitted.

## 4. Guardrails

- **G-1 No medical advice.** Don't diagnose, interpret readings, or suggest the devices replace medical care. Metrics such as ECG, SpO2, HRV, stress and "cortisol" are for wellness and fitness. For health concerns, suggest seeing a professional. (The site uses "diagnostic" loosely; don't extend it.)
- **G-2 No competitors.** Don't compare with, rate or discuss other brands (for example Apple, Oura, Whoop, Garmin, Meta). Steer back to PULSE.
- **G-3 No legal or compliance.** Don't interpret warranties, certifications, data-privacy law or regulatory status beyond the published text.
- **G-4 No promises.** No discounts, stock levels, delivery dates, release dates, or unreleased products (the "Modular Pro series" is roadmap only).
- **G-5 No sensitive data.** Don't ask for or accept health data, payment details or passwords in chat.
- **G-6 No account actions.** There's no order-status or account lookup. Point to email.

## 5. Suggestions (prompt pills and follow-ups)

Welcome prompts:
- Which PULSE fits my training?
- PULSE Loop vs PULSE Arc?
- How long does the battery last?
- Do you ship to my country?

Follow-ups:
- Can I swap straps?
- What's the return policy?
- Where are your labs?
- How do I join the Discord?

---

## 6. Visual style (from the PULSE design tokens)

| Setting | Value |
|---|---|
| Font | `'Inter', 'Inter-fallback', sans-serif` (already loaded by the site) |
| `--color-primary` | `#1d4ed8` (PULSE blue) |
| `--color-primary-hover` | `#1e40af` |
| `--color-button-primary` / `--color-button-submit` | `#1d4ed8`; hover `#1e40af` |
| `--color-accent` | `#f97316` (PULSE orange) |
| `--color-message-user` | `#1d4ed8` |
| `--main-container-background` | `#f7f8fa` (surface). Avoid gradients; the site is flat. |
| Text | `#111827` (ink); secondary `rgb(17 24 39 / 70%)` |
| Corners | 8 px on controls, 12 px on cards |
| Welcome heading / subheading | "What's your frequency?" / "Ask about PULSE devices, specs, shipping, or which wearable fits your day." |
| Input placeholder | "Ask PULSE anything" |
| Disclaimer | "AI answers can be wrong. Check the product page for final prices and policies." |
| Privacy notice | Adobe's default text; **Decide:** legal review |
| Brand icon | The "P" mark from the site logo (SVG) |

---

## 7. Knowledge sources and skills

| Item | Setting |
|---|---|
| Website Links | **CSV upload** of `knowledge-source-urls.csv`: the 10 real pages. Don't use the sitemap until conflict #7 is fixed, because it still lists the 5 placeholder pages. Refresh weekly. |
| Product Catalog | `product-catalog.csv`: the 4 products with pages. This enables product cards and deep links. Add the 6 products without pages once they have pages. |
| Skills | Site Advisory (default). Product Advisory, using Knowledge Base Search and Entity Linking. |
| Not applicable | Commerce MCP (the site isn't on Adobe Commerce); Meeting Booking and Live Chat (B2C, no sales team) |
| Host | URLs use `main--ema-da-demo--sanjeevkshu.aem.live` until the production domain exists. **Check the first crawl.** The `.aem.live` hosts send `x-robots-tag: noindex` and a disallow-all `robots.txt`, and Adobe doesn't document whether its crawler honours them. If the source shows *Partial success*, use **Fix Issues** to see the failures, or crawl the production domain. |

---

## 8. Evaluations

`evaluation-set.csv` has 20 question and expected-answer pairs:
- 12 functional
- 4 out of scope
- 4 safeguard

Expected answers that depend on conflicts #1–#4 are marked `PENDING`. Update
them after the fix, then run each type before go-live and after every
configuration change.

---

## 9. Website integration (Edge Delivery)

Needed from the Adobe/IT team:
- the **IMS Org ID**
- a **datastream ID** enabled for Brand Concierge
- the **production domain**, for surface rules

How it fits this codebase:

- **Load late.** Load the Web SDK (`alloy`) and the Brand Concierge Web Client in the delayed phase. Adobe's snippet puts them in `<head>`, which would cost LCP on every page. `scripts/scripts.js` → `loadDelayed()` → `consent-check.js` → `consented.js` is the existing hook.
- **Decide: consent.** Loading from `consented.js` means the concierge only appears after consent, which is declined by default today. Loading it outside consent needs legal sign-off, because the Web SDK sends data to Adobe Experience Platform.
- **Content Security Policy.** `head.html` enforces `require-trusted-types-for 'script'`. Test the Web SDK and Web Client on a branch first. If they fail Trusted Types, the options are a Trusted Types policy or relaxing that one directive.
- **Mount point.** For a component install, create `#brand-concierge-mount` in JS. For a dedicated page, use a `concierge` block on a `/concierge` page. The styling configuration (section 6) lives in a JSON file in the repo.
- **Surface rules.** Start with product and brand pages. Exclude `/search` and `/contact` until the forms work.
- **Analytics.** Use the `onEvent` callback, for example forwarding `card:clicked` and `query:submitted`, without blocking.
