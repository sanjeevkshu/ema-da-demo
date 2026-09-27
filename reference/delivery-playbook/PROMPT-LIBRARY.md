# PULSE prompt library

Reusable prompts from the PULSE delivery sessions, mapped to the Agentic
Delivery Lifecycle (ADLC), the Frontier Engineering Model and engineering roles.
Kept current by `.claude/skills/prompt-library`. Not served (`*.md` is in `.hlxignore`).

This repo is public: no prices, client names, credentials or personal data here.
The AI-credit cost model lives outside git.

## Source sessions

| Session | Dates | Prompts | Delivered |
|---|---|---|---|
| S1 Figma → EDS foundation | 2026-09-16 | 24 | 10 pages, 16 blocks, design-token pipeline, Figma sync map, Lighthouse CI |
| S2 Design and build add-on | 2026-09-21 | 20 | Hero carousel, full-bleed hero, 4 pages, Figma assets into DA, 80% coverage gate and backfilled tests, navigation and home |
| S3 Search, integrate, deploy | 2026-09-25 to 27 | 45 | DA library and auto-update skill, experience audit, index/sitemap/search, Brand Concierge with Web SDK and consent, integration CI, 8 pages incl. legal, chat theme, phone menu |

What the 89 prompts show:
- **About 38% were release handoffs** ("open PR", "PR merged", "run the queue"), because the agent can't open or merge PRs here.
- **About half of S3 went on diagnosing an external platform** (Brand Concierge crawl, datastream service, surface rules); most of the fixes were console steps.
- **Standing rules ran unasked** once written down: library update, coverage gate, integration coverage, project notes.

## Frameworks

**ADLC phases:** P0 Context, P1 Discover, P2 Plan and architect, P3 Build,
P4 Verify, P5 Integrate, P6 Release, P7 Operate, P8 Evolve.

**Frontier Engineering Model:** read here as an autonomy ladder. If your
organisation defines its own tiers, map them onto F1–F4.

| Level | Mode | The human… | Pilot example |
|---|---|---|---|
| F1 Assist | Agent explains and advises; human acts | does the work | AEP datastream, Composer console steps |
| F2 Co-create | Agent drafts; human reviews each step | approves each output | Legal drafts with markers, robots.txt proposal |
| F3 Delegate | Agent runs the task end to end behind gates | approves at the PR | Blocks, tests, CI, search, consent |
| F4 Guardrailed autonomy | Agent acts unasked under standing rules | audits outcomes | Library auto-update, coverage rules, project notes |

**Roles:** SA Solution Architect, UX Experience Designer, FE EDS/Front-end
Engineer, INT MarTech/Integration Engineer, QA SDET, DO DevOps/Release,
CA Content Author/Strategist, SEC Privacy/Compliance, DL Delivery Lead.

## Prompt structure

The prompts that worked best had five parts:
1. **Intent:** the outcome wanted.
2. **Scope:** a numbered list of items.
3. **Constraints:** "no regression", "report-only", "no code change".
4. **Definition of done:** tests, preview link, captured in a README.
5. **Decision rights:** "advise and ask for confirmation".

Guardrail suffixes to reuse:
- "…advise and ask for confirmation before acting."
- "…report-only; don't gate yet."
- "…ensure no regression: compare before and after at phone, tablet and desktop."
- "…ship tests at ≥80% per file and update the library."
- "…open a PR into develop with Before/After preview links."
- "…capture it as a skill or standing rule so it happens unasked."
- "…capture gaps in reference/README."

## Library

The ID prefix is the ADLC phase. `Seen` is the session the pattern came from.

### P0 Context and onboarding

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P0.1 | "Load context from the project skills, AGENTS.md, reference docs and your notes. Summarise what changed since last session, open items and blockers, then confirm ready." | All | F3 | S2, S3 |
| P0.2 | "Memorise the status quo (merged work, open PRs, pending decisions, leftovers) and prioritise the next step." | DL | F3 | S3 |
| P0.3 | "Update settings: from the next session enable {capability}. Record it as a standing rule." | DL, DO | F4 | S1 |

### P1 Discover and analyse

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P1.1 | "Migrate my Figma file {url} to EDS: all frames into page templates and blocks. Extract design tokens and set up future automated design sync." | UX, FE | F3 | S1 |
| P1.2 | "Run a block-by-block diff of design versus build on local and published previews. Rank deviations by severity, fix them all, and keep the diff as a reusable check." | UX, QA | F3 | S1 |
| P1.3 | "Why can {platform} do {X} for {reference site} but not for {our site}? Rank hypotheses and give a test for each. Change nothing yet." | SA, INT | F2 | S3 |
| P1.4 | "Fix the content gaps found during {integration} and record them in reference/README." | CA | F3 | S3 |

### P2 Plan and architect

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P2.1 | "Need support on the following: 1…n. For each item give the approach, options, a recommendation and what you need from me." | SA, DL | F2 | S3 |
| P2.2 | "Advise and plug {gate} into the {branch} merge flow. Advise and ask for confirmation." | SA, DO | F2 | S3 |
| P2.3 | "Map {component} from the design as a variant or a new block. Make the optimum call and justify it." | SA, FE | F3 | S2 |
| P2.4 | "Enforce best practices for setting up {platform}. Give a step-by-step walkthrough of what I do in {console} and what you do in code." | INT | F1/F3 | S3 |

### P3 Build

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P3.1 | "Build {block} from {design}. Responsive at 390, 768 and 1440 px, design tokens only, tests ≥80%, library entry included." | FE | F3 | S2 |
| P3.2 | "There's no design for {feature}. Build it in the existing design language: accessible, works without JavaScript, fast to respond (INP)." | FE, UX | F3 | S3 |
| P3.3 | "Add {n} {page type} pages following {template} and link them into navigation, products and discover." | CA, FE | F3 | S2, S3 |
| P3.4 | "Build consent that gates {third party} for real visitors. Accept and Decline equally prominent, reopenable from the footer." | FE, SEC | F3 | S3 |
| P3.5 | "Create /privacy and /terms-of-service as drafts with [To be confirmed] markers for legal review." | CA, SEC | F2 | S3 |
| P3.6 | "Optimise {component} for font sizes and spacing, WCAG AA and responsive layout. Ensure no regression." | FE, UX | F3 | S3 |

### P4 Verify and quality

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P4.1 | "Add a CI gate requiring ≥80% functional test coverage per file for all blocks, and add it as a skill." | QA | F4 | S2 |
| P4.2 | "Backfill unit tests for existing blocks, then raise a PR." | QA | F3 | S2 |
| P4.3 | "Implement PSI/Lighthouse compliance checks and expand them to all {n} pages." | QA, DO | F3 | S1 |
| P4.4 | "Prove no regression: measure live against the branch at 3 widths, and add a check that fails on the old behaviour." | QA | F3 | S3 |
| P4.5 | "Review this PR and resolve the gaps: {url}." / "Spot-check {page} visually." | QA, FE | F3 | S2 |

### P5 Integrate

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P5.1 | "Integrate the site with {platform}: profile inputs, SDK wiring, IDs per environment, consent." | INT | F3 | S3 |
| P5.2 | "Use {domain} as the production domain and update the site configuration and specs to match." | DO | F3 | S3 |
| P5.3 | "Let {crawler} in while the public site stays noindex. Propose the robots rules and a timed 15-minute test." | INT, SEC | F2 | S3 |
| P5.4 | "In {console} → {path} I see {options}. What is expected here?" | INT | F1 | S3 |
| P5.5 | "Maintain a skill for system-integration coverage and gate PRs into main." | QA, DO | F4 | S3 |

### P6 Release and deploy

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P6.1 | "Open a PR into develop with Before/After preview links and a full description." | DO | F3 | S1 |
| P6.2 | "Queue these for the next DA publish" / "Run the queue" / "Publish everything to live." | CA, DO | F3 | S1, S2 |
| P6.3 | "The PR conflicts with develop. Resolve it, do the one-time branch reconciliation, and sync local branches." | DO | F3 | S2 |
| P6.4 | "The preview doesn't match local. Verify everything is pushed, then verify production." | DO, QA | F3 | S1 |
| P6.5 | "Promote develop to main with a merge commit, then verify live." | DO | F3 | S3 |

### P7 Operate and observe

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P7.1 | "Enable a report-only experience audit per unique page type on main, and check the run results." | QA, DO | F3 | S3 |
| P7.2 | "Set up the index and queries, the sitemap and site search." | FE, SA | F3 | S3 |
| P7.3 | "{Error text}. Diagnose it, list the causes, and test the most likely first." | INT, DO | F3 | S3 |

### P8 Evolve and learn

| ID | Prompt template | Role | Level | Seen |
|---|---|---|---|---|
| P8.1 | "Keep the block and template library up to date on every change, without being asked." | FE | F4 | S3 |
| P8.2 | "Why did local differ from published, and how do we make sure it never recurs? Encode the rule." | SA | F4 | S1 |
| P8.3 | "Help me understand which layer controls {behaviour}." | All | F1 | S3 |

## EMA co-worker by role

| Role | EMA co-worker does | Human stays accountable for | Levels |
|---|---|---|---|
| Solution Architect | Options analysis, root-cause hypotheses, standing rules | Architecture and platform decisions | F2–F4 |
| UX Designer | Figma ingestion, design-vs-build diff, accessibility | Design intent, sign-off | F3 |
| EDS/FE Engineer | Blocks, tests, library, regression proofs | Code review at the PR | F3–F4 |
| Integration Engineer | SDK wiring, configuration, guided console setup | Console, ID and sandbox decisions | F1–F3 |
| QA/SDET | Coverage gates, integration specs, audits | Quality bar, gating policy | F3–F4 |
| DevOps/Release | PRs, branches, publishing, CDN checks | Merges, production promotion | F3 |
| Content Author | Pages, navigation, content-gap fixes | Messaging, brand voice | F2–F3 |
| Privacy/Compliance | Consent build, legal drafts | Legal wording, approvals | F2 |
| Delivery Lead | Status snapshots, prioritising | Scope, client commitments | F2 |

## Changelog

- 2026-09-27: first version from sessions S1–S3 (38 prompts).
