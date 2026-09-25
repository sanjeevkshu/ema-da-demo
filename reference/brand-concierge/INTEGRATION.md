# Brand Concierge: step-by-step integration with the Web SDK and AEP

End-to-end setup for PULSE: from Adobe access to a live, measured concierge.
Each step lists who does it, what to do, and how to check it's done. The
brand inputs (profile, instructions, guardrails, knowledge sources,
evaluations) are in [`README.md`](README.md). The website code already exists:
`scripts/brand-concierge.js`, and it stays off until step 7.

Sources:
- Adobe's Brand Concierge docs (`github.com/AdobeDocs/brand-concierge.en`): access, knowledge sources, manage, evaluate, deploy, developer guide, go-live, analytics.
- Adobe's public demo integration (`github.com/nirmaljosehere/frescopa-bc`), which shows the `conversation.region` setting and the Composer styling export.

**Status (2026-09-25):**
- Steps 7 and 9 are already built on branch `feat/brand-concierge-embed`.
- The preflight on the branch preview passed: the Web SDK and the Web Client load under the site's security policy with no violations, and the Web SDK reaches the Edge Network.
- Steps 1–6 and 8 are Adobe-side work for your team.

| # | Step | Owner | Needs |
|---|---|---|---|
| 1 | Access and sandboxes | AEP admin | Brand Concierge entitlement |
| 2 | Datastreams (dev, stage, prod) | IT / analytics | Step 1 |
| 3 | Create the concierge in Composer | Marketer | Step 1 |
| 4 | Knowledge sources, skills, brand setup | Marketer | Step 3 |
| 5 | Evaluations | Marketer | Step 4 |
| 6 | Deployment config in Composer | Marketer + IT | Steps 2, 5 |
| 7 | Website config and branch test | Web team | Steps 2, 6 |
| 8 | Surface rules | Marketer | Step 7 |
| 9 | Go live on `.aem.live`, then `pulse-proxy-redirect.vercel.app` | All | Steps 1–8 |
| 10 | Operate | Marketer | Live |

---

## 1. Access and sandboxes (AEP admin)

1. **Admin Console → Users:** add each person to the organisation with the *Adobe Experience Platform* product profile.
2. **experienceplatform.adobe.com → Permissions → Roles → Create role:** create "Brand Concierge Access Users" with the **Manage Brand Concierge** permission. It's currently the only Brand Concierge permission.
3. On the role, select only the sandboxes it needs:
   - a **development** sandbox, for building and testing
   - the **production** sandbox, for go-live
4. Add users to the role (role → Users tab).

**Check:** each user can sign in to experienceplatform.adobe.com, open *Brand Concierge*, and see the right sandboxes.

**Best practice:**
- Build and evaluate in a development sandbox. Recreate or promote to production only after evaluations pass.
- Also add `sanjeevkshu@gmail.com` to the DA permissions sheet. The handover found them as a site admin who isn't on it.

## 2. Datastreams: one per environment (IT / analytics)

In the right sandbox, go to **Data Collection → Datastreams → New datastream**, and create:

| Datastream | Sandbox | Used on | Goes in `CONFIG.datastreams` |
|---|---|---|---|
| `pulse-bc-dev` | development | `*.aem.page` branch previews, `localhost` | `dev` |
| `pulse-bc-stage` | development (or a stage sandbox) | `main--ema-da-demo--sanjeevkshu.aem.live` | `stage` |
| `pulse-bc-prod` | production | `pulse-proxy-redirect.vercel.app` (production domain) | `prod` |

Also note the **IMS Org ID** (`…@AdobeOrg`, shown in the Admin Console). It goes in `CONFIG.orgId`.

**Check:** you have three datastream IDs and the org ID. They're public by design: they appear in every page's network calls. Nothing here is a secret.

**Best practice:**
- **Separate datastreams per environment,** so test traffic never lands in production datasets or reports. Adobe's datastream video recommends this.
- **Don't hand-build schemas or datasets for the concierge.** Brand Concierge provisions its own (`cja_brand_concierge_*`) and a Customer Journey Analytics (CJA) dashboard.

## 3. Create the concierge (Marketer, Composer)

1. In the **development** sandbox, open Brand Concierge → create a concierge from **`https://pulse-proxy-redirect.vercel.app/`**, the production domain. Its `robots.txt` admits the Adobe crawlers. Don't use `.aem.live`: see the known issue below.
2. Review each generated draft against `README.md`, and correct it before selecting **Continue**:
   - brand expression (§1)
   - brand profile (§2)
   - instructions, guardrails and suggestions (§3–5)

**Check:** the preview answers "How long does the PULSE Loop battery last?" with about 7 days.

> **Known issue on `.aem.live` (seen 2026-09-25):** the concierge is created with a brand profile, but with **no integrations, no skills and no working preview**.
>
> **Why:**
> - The profile is drafted from one fetch of the URL you enter.
> - The knowledge base, the Knowledge Base Search integration and the Site Advisory skill all depend on a background crawl of the site's top pages.
> - `*.aem.live` and `*.aem.page` always serve `robots.txt` `Disallow: /` and `x-robots-tag: noindex, nofollow`. The platform forces both.
> - A custom `robots.txt` (Config Service) is **not** served on these hosts; this was tested. It applies only on a production domain.
>
> **Recovery, in order:**
> 1. **Knowledge Sources:** check the auto-created source's status and **Fix Issues** file.
> 2. **Add a Website Links source by hand.** Upload the CSV `knowledge-source-urls.csv`, so no link-following is needed. Then add the **Knowledge Base Search** integration pointing at it, and turn on **Site Advisory** (Modify → Use recommended).
> 3. **If it's still refused (robots):** upload a PDF/DOCX knowledge document, plus the Product Catalog sheet. Neither needs a crawl.
> 4. **Lasting fix (done 2026-09-25):** the site is served on `https://pulse-proxy-redirect.vercel.app`, a Vercel reverse proxy, and `cdn.prod.host` is set. Recreate the concierge from that URL.
>    - That domain gets `reference/site-config/robots.txt` (already applied), which allows the Adobe crawlers and disallows everyone else.
>    - Confirm the crawler user-agent tokens with Adobe first; they aren't in the public docs.
>    - Re-point the knowledge source at that domain.

## 4. Knowledge sources, skills, visual style (Marketer)

1. **Knowledge source → Website Links → Sitemap URL:** `https://pulse-proxy-redirect.vercel.app/sitemap.xml`, 10 pages. Schedule a weekly refresh.
2. **Watch the first crawl status.** It shows whether the Adobe crawler identifies itself with one of the allowed user agents.
   - **Success:** done. Public search engines stay out: the domain's `robots.txt` disallows every other crawler, and `.aem.live` stays blocked by the platform.
   - **Partial success, or fails:** use **Fix Issues** to download the error list. If it's a robots block, ask Adobe for the crawler's exact user-agent token, and add it to `reference/site-config/robots.txt` and the Config Service.
3. **Knowledge source → Product Catalog:** pick a schema, download Adobe's sample sheet, copy in `product-catalog.csv`, and upload it.
4. **Skills:** Site Advisory (on by default). **Product Advisory**, with Knowledge Base Search and Entity Linking.
   - Leave Commerce MCP off: the site isn't on Adobe Commerce.
   - Leave Meeting Booking and Live Chat off: PULSE sells direct to consumers and has no sales team.
5. **Visual style and chat components:** set them from `README.md` §6. Then **export the styling configuration** and replace `scripts/brand-concierge-styles.json` with it, in a PR. The Composer export is the only source of truth; the repo file is a draft until then.

**Check:**
- Both knowledge sources show *Success*.
- The preview shows product cards for "Show me PULSE Loop".

**Best practice:**
- **One source of truth for content.** Fix contradictions on the site, not in the concierge. `README.md` §0 lists the conflicts already fixed and the ones still open.
- **Keep placeholder pages out.** Mark them `robots: noindex`, as already done for the 5 wireframe pages. That removes them from the sitemap, site search and the crawl together.

## 5. Evaluations (Marketer)

1. **Evaluations → Create evaluation set → spreadsheet upload:** upload `evaluation-set.csv`, one set per `type`:
   - 12 functional
   - 4 out of scope
   - 4 safeguard
2. Run each set. Review every **flagged** result, and fix the source (site content, instructions or guardrails) rather than the expected answer.

**Check:** no unresolved flagged answers. Safeguard answers show no medical advice (guardrail G-1), no invented discounts, and no card details accepted.

**Best practice:** rerun all three sets after **any** change to instructions, guardrails, skills, integrations or knowledge sources. Add real visitor questions from Analytics as they come in (step 10).

## 6. Deployment configuration (Marketer + IT)

1. **Composer → Deploy → Add Config:** paste the datastream ID for the sandbox you're deploying from. Save.
2. Choose **Component install**; it matches the site's launcher. Copy the generated snippet.
3. **From the snippet, note:**
   - the `conversation.region` value (the demo uses `va7`)
   - the Web SDK version
   - any extra `bootstrap` options

   You don't paste the snippet into the site. The site's loader already does everything it does (step 7).

**Check:** you have the region, SDK version and options from the snippet, and they match `CONFIG` in step 7, or the differences are noted for the web team.

## 7. Website configuration and branch test (Web team)

The loader (`scripts/brand-concierge.js`) already does the following:
- **Consent:** it's imported from `scripts/consented.js`, so nothing loads or reaches Adobe before consent. Withdrawing consent calls `setConsent` with `general: out`.
- **Where it shows:** it adds an **"Ask PULSE"** launcher on surface pages only.
- **When it loads:** the Web SDK and the Web Client (third-party, about 300 KB) load on the **first open**, so page speed (LCP, INP) is unaffected.
- **Environments:** it picks the datastream for the environment (`.aem.page` → dev, `.aem.live` → stage, anything else → prod).
- **Safe defaults:** third-party cookies are off, and debug logging is off unless `?concierge=debug`.
- **Kill switch:** `?concierge=off` skips it for one page view.
- **Performance:** it adds nothing to the page's critical path.

To turn it on:

1. Branch from `main`, for example `feat/bc-ids`.
2. In `scripts/brand-concierge.js`, fill in `CONFIG`:
   ```js
   orgId: 'XXXXXXXXXXXXXXXXXXXXXXXX@AdobeOrg',
   datastreams: { dev: '<pulse-bc-dev id>', stage: '<pulse-bc-stage id>', prod: '' },
   region: '<conversation.region from the snippet>',
   ```
   - Set `prod` (the `pulse-bc-prod` datastream) only when the concierge should go live on `pulse-proxy-redirect.vercel.app`. While it's empty, the production domain simply doesn't load the concierge.
   - If the snippet uses a newer Web SDK, update `ALLOY_URL`. Keep the version **pinned** (never "latest"), so an SDK update can't change the site without a PR.
3. Replace `scripts/brand-concierge-styles.json` with the Composer export (step 4.5).
4. Run `npm run lint && npm test`. `test/brand-concierge.test.js` checks the environment mapping, surface paths, consent opt-out and lazy loading.
5. Push. Open `https://feat-bc-ids--ema-da-demo--sanjeevkshu.aem.page/pulse-loop?consent=accept&concierge=debug`.
   - Until a real consent manager replaces `scripts/consent-check.js`, `?consent=accept` stands in for accepting the banner.
6. Check each of these:
   - [ ] The "Ask PULSE" launcher appears. There's **no** request to `adoberesources.net` or `experience.adobe.net` before you open it.
   - [ ] Opening it loads both scripts. The console shows `[alloy] Instance configured` and **no** `securitypolicyviolation` errors.
   - [ ] `edge.adobedc.net/ee/v1/interact` returns **200**, not 400. A 400 means a wrong org ID or datastream, or a datastream not enabled for Brand Concierge.
   - [ ] The chat renders, answers a question, and shows product cards.
   - [ ] **Escape** and **×** close it, focus returns to the launcher, and on a phone the panel is full screen.
   - [ ] `/contact` and `/search` show **no** launcher, and without `?consent=accept` there's no launcher at all.
   - [ ] **Adobe Experience Platform Debugger** (browser extension) or **Assurance** shows the events arriving on `pulse-bc-dev`.
7. Open a PR into `develop` with the branch URL. The PR checks (build, Lighthouse, PSI) must stay green. The launcher costs nothing until it's opened, so page scores shouldn't move.

## 8. Surface rules (Marketer, Composer)

In **Composer → Surface**, add these domains:
- `main--ema-da-demo--sanjeevkshu.aem.live` (stage)
- any branch hosts used for testing
- `pulse-proxy-redirect.vercel.app`, the production domain, at go-live

Path rules must **match `CONFIG.paths`**:
- equals `/`, `/know-the-brand`, `/lifestyle-vision`, `/discover`, `/product-discovery`, `/product-details`
- starts with `/pulse-`

Leave `/contact` and `/search` out until the contact form works.

**Check:** the launcher appears on an included page and not on an excluded one. Adobe recommends testing both kinds.

**Best practice:** the site's `CONFIG.paths` stops the SDK loading where the concierge can't appear, and Composer's surface rules decide what's shown. **Change both together**, in the same PR and Composer session.

## 9. Go live

1. Work through [`go-live-checklist.md`](https://github.com/AdobeDocs/brand-concierge.en/blob/main/help/documentation/go-live-checklist/go-live-checklist.md): knowledge sources processed, profile approved, evaluations clean, datastream set, surface reviewed, script installed, analytics access.
2. **Legal:** approve the privacy-notice text and link (the repo draft points to `/contact`, because the site has no privacy page yet), the disclaimer, and the consent approach (loaded only after consent).
3. Merge `develop` → `main` with a merge commit. The concierge goes live on `.aem.live`, in the stage environment. **After the merge,** check that the live site serves the new `scripts/brand-concierge.js`. On 2026-09-25 the CDN served a stale `header.js` after a merge; `POST https://admin.hlx.page/code/sanjeevkshu/ema-da-demo/main/*` fixed it.
4. **Production domain `pulse-proxy-redirect.vercel.app`.**
   - **Done (2026-09-25):**
     - `cdn.prod.host` set
     - sitemap `origin` switched, so all 10 URLs are on the domain
     - `robots.txt` allows only the Adobe crawlers
     - canonical and `og:url` use the domain
     - the knowledge source and product catalog files point at it
   - **At go-live:**
     - add the `prod` datastream (production sandbox) to `CONFIG`
     - add the domain to the surface rules
     - replace the `robots.txt` group `User-agent: *` / `Disallow: /` with `Allow: /`, so search engines can crawl

## 10. Operate

- **Weekly:**
  - read the transcripts (Composer → Analytics)
  - add real questions the concierge got wrong to an evaluation set
  - check the knowledge-source refresh status
- **After any site content change:** content publishes to `.aem.live` right away, and the weekly refresh picks it up. Refresh the knowledge source by hand for urgent changes (prices, policies).
- **After any concierge change:** rerun the three evaluation sets (step 5).
- **Reporting:**
  - **CJA:** Composer → Analytics → View Report opens the provisioned CJA dashboard.
  - **Other analytics tools:** add an `onEvent` callback to `bootstrap()` in `scripts/brand-concierge.js`, and forward `query:submitted`, `card:clicked` and `feedback:submitted` with `navigator.sendBeacon`. Keep it non-blocking, and never forward the query text to tools outside Adobe without legal review.
