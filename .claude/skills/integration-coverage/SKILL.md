---
name: integration-coverage
description: Keep PULSE's system-integration checks (test/integration) complete and green. Use without being asked whenever a change touches an integration (Brand Concierge / Web SDK / AEP, consent, the query index or search, robots.txt / sitemap / production domain, the header or footer fragments, or any new third-party script or Config Service file), when test/integration-coverage.test.js fails, or when the Integration check fails on a PR into main.
---

# Integration coverage (sanjeevkshu / ema-da-demo)

The unit tests (`npm run test:coverage`) prove each block works in isolation.
These checks prove the site works **with the systems around it**, on a real
deployed host: Adobe's Edge Network and Brand Concierge, the Config Service,
the production domain's proxy and crawl rules, and the DA-authored fragments.

| Integration | Code | Spec |
|---|---|---|
| Consent gate | `scripts/consent-check.js`, `scripts/consented.js` | `consent.spec.js` |
| Brand Concierge + Web SDK / AEP | `scripts/brand-concierge*.{js,json}`, `styles/brand-concierge.css` | `brand-concierge.spec.js` |
| Query index + search | `blocks/search/*`, `reference/site-config/query.yaml` | `search.spec.js` |
| Crawl rules + production domain | `reference/site-config/robots.txt`, `sitemap.yaml` | `crawl.spec.js` |
| Header and footer fragments | `blocks/header`, `blocks/footer`, `blocks/fragment` | `fragments.spec.js` |

The map lives in `test/integration/coverage.json`.

## The gates

1. **Unit level, in every build.** `test/integration-coverage.test.js` fails `npm test` in these cases:
   - a file in `scripts/` (other than `aem.js` and `scripts.js`), or a file in `reference/site-config/`, has no entry in `coverage.json`
   - a mapped file or spec is missing
   - a spec belongs to no integration
2. **Live checks.** `.github/workflows/integration.yaml`, job **"Integration (gate)"** (required on `main`):
   - PRs into `main` (the `develop` → `main` promotion): the full suite on the PR's branch preview.
   - PRs into `develop`, only when a mapped integration file changes: consent, search and fragments, without the Brand Concierge spec (it starts real chats).
   - Nightly on `main`.
   - After every merge to `main`, `post-deploy.yaml` checks that aem.live serves the commit's code, then runs the no-chat specs plus crawl on aem.live and the production domain.
3. **`@golden` answers, report-only.** These are Brand Concierge answers checked against site facts: Loop 7 days, Band Neo $129, free shipping over $100. They run in the same job but can't fail it.
   - Once grounding is fixed and they pass on three consecutive runs, delete the `continue-on-error` step and drop `--grep-invert @golden`.

## When you change an integration (no request needed)

| Change | Do |
|---|---|
| New third-party script, SDK, or file in `scripts/` | Add an integration to `coverage.json` and a spec that proves the happy path, the failure mode users would notice, and the privacy boundary (consent) |
| Change to the Brand Concierge loader, IDs, region or styles | Update `brand-concierge.spec.js`. Keep the CSP-violation, 200-status and close/Escape checks |
| New index field, search behaviour or Config Service file | Update `search.spec.js` or `crawl.spec.js`, and add the file to `coverage.json` |
| Production domain or robots change | Update `crawl.spec.js` (`PROD_URL` in `helpers.js`) |
| Nav or footer structure change | Update `fragments.spec.js` |
| New site fact the concierge must know | Add a golden question |

## Run locally

```sh
npx playwright install chromium          # once
INTEGRATION_BASE_URL=https://<branch>--ema-da-demo--sanjeevkshu.aem.page npm run test:integration
npm run test:integration -- --grep @golden   # only the grounded-answer checks
```

- **Consent:** the specs pass `?consent=accept`, because the site's consent stand-in declines by default.
- **Analytics:** each run starts about 5 real chats on the single datastream, so they appear in Brand Concierge analytics. A dev datastream (`CONFIG.datastreams.dev`) would keep them apart.

## When the gate fails

- `BRANDCON-0002-400` / "Datastream config not found": the datastream isn't enabled for Brand Concierge. See `reference/brand-concierge/INTEGRATION.md` step 2.
- An empty chat panel: the styling config is missing text strings (step 7.3).
- Robots or sitemap mismatch: see `AGENTS.md` (production domain) and `reference/site-config/`.
- A stale preview: the workflow warns if the branch preview didn't serve the commit's code in time. Re-run it.
