# Block unit tests & coverage gate

Functional tests for EDS blocks, run on Node's built-in test runner
(`node:test`) with a **jsdom** DOM. No browser, no build step — matching the
project's "devDependencies only" constraint.

## Run

```sh
npm test              # run all block tests
npm run test:coverage # run tests AND enforce the 80% coverage gate
```

`test:coverage` fails (non-zero exit) if **line, branch, or function** coverage
of **any single** `blocks/**/*.js` file drops below **80%**, or if a block file
isn't loaded by any test. `test/check-coverage.js` enforces this from
`coverage/lcov.info`. CI runs it on every push (`.github/workflows/main.yaml`),
so a regression blocks the merge.

## How it works

- `test/setup.js` stands up a jsdom `window`/`document`, mirrors the globals a
  `decorate()` expects (including a controllable `matchMedia`), and provides
  helpers (`buildCarousel`, `setReducedMotion`, …).
- Each `test/<block>.test.js` imports the block module *after* the DOM globals
  exist, then drives `decorate()` and asserts on the resulting DOM and behaviour
  (navigation, keyboard, autoplay, a11y roles, responsive/variant branches).

## Writing tests for a new block — the 80% rule

**Every new or modified block must ship with tests that keep coverage ≥ 80%.**
This is a hard CI gate, not a guideline.

1. Add `test/<block>.test.js`.
2. `import { installDom } from './setup.js';` then `installDom();` before
   importing the block module.
3. Build the authored DOM (canonical DA `block › row › cell(s)`), call
   `decorate`, and assert structure + interaction.
4. Cover the branches: each variant class, each defensive `if`, each event
   handler. Run `npm run test:coverage` and drive the uncovered-lines column to
   zero.
5. Factor non-DOM logic into small pure exported helpers (e.g. `wrapIndex`) —
   they are trivial to test and lift branch coverage cheaply.

> Node only reports coverage for files a test actually loads. The checker
> compares the report with `blocks/` on disk, so a new block without a test
> fails the build with "no coverage data" instead of slipping through.
> See `reference/testing-and-coverage.md` for the full policy.
