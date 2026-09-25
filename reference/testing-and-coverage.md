# Testing & coverage policy (skill/instruction)

**Rule: all new block development must ship functional tests with ≥ 80% code
coverage (lines, branches, functions). This is a CI gate — a PR that drops any
block below 80% is rejected.**

This is the standing instruction for anyone (human or agent) adding or changing
a block in this project.

## Why

Blocks are the unit of behaviour in EDS. They run untranspiled in the browser
and are easy to break silently (a stripped class, a null cell, a variant that
no longer decorates). A fast jsdom test suite catches these before they reach
the published DA site — where, per `reference/da-authoring-rules.md`, defects
are hardest to see.

## The gate

- Runner: Node's built-in `node:test` + `--experimental-test-coverage` (Node
  20+; CI pins 24). DOM via `jsdom` (devDependency only — no build step).
- Command: `npm run test:coverage`. It runs the suite, writes
  `coverage/lcov.info` (gitignored), then runs `test/check-coverage.js`.
- **The threshold applies to each file, not the total.** Node's own
  `--test-coverage-*` flags only check the aggregate, which let `header.js`
  (62.5% functions) and `widget.js` (69% branches) pass while the total read
  93%. `check-coverage.js` fails the build when any `blocks/**/*.js` file is
  under 80% on lines, branches or functions.
- **A block no test loads fails too.** Node leaves unloaded files out of the
  report, so the checker compares it with the files on disk and reports
  "no coverage data" for any it can't find.
- CI: `.github/workflows/main.yaml` runs it on every push, after lint.

## Workflow for a new/changed block

1. Write the block (`blocks/<name>/<name>.js` + `.css`).
2. Add `test/<name>.test.js` (see `test/README.md` for the pattern).
3. `npm run test:coverage` locally; drive uncovered lines to zero, ≥ 80% each.
4. `npm run lint` (airbnb-base + stylelint-standard) must also pass.
5. Open the PR — CI re-runs both gates; the PR needs a green build **and** the
   `{branch}--{repo}--{owner}.aem.page/<path>` preview link (see AGENTS.md).

## Tips that make 80% cheap

- Extract pure logic into exported helpers (e.g. `wrapIndex`,
  `readSlideCells`, `prefersReducedMotion`) and unit-test them directly.
- Test each variant class path (`.split`, `.backdrop`, `.thumbnails`, …) and
  each defensive branch (missing cell, single item, no image).
- Drive event handlers by dispatching real events (`click`, `keydown`,
  `pointerdown`/`pointerup`) on the decorated DOM.
- For timers/autoplay, expose `stop()`/`start()` from `decorate` and call
  `stop()` at the end of the test so the Node process can exit; `unref()` the
  interval in the block as a belt-and-braces measure.
- Control media queries with the `setReducedMotion()` helper.

## Harness gotchas (each cost a debugging round)

- **Importing any block runs `scripts/scripts.js`**, and its `loadPage()`
  executes at import. Against an empty jsdom document it rejects
  asynchronously, and Node marks the whole test file failed even when every
  assertion passes. `test/setup.js` installs a page skeleton
  (`header`, `main > .section`, `footer`) so the bootstrap finishes cleanly.
  Keep the skeleton.
- **Set `window.hlx` before importing** any block that pulls in `scripts.js`.
- **`navigator` is a read-only getter in Node 24.** Assigning to it throws;
  `setup.js` falls back to `Object.defineProperty`.
- **Use real `aem.js` exports only.** `fetchPlaceholders` does not exist in
  the vendored `aem.js`. Check the export list at the bottom of the file first.
- **Module-scoped `matchMedia` handles need stubbing before import.**
  `header.js` calls `matchMedia('(min-width: 900px)')` once, at load. Install
  a stub that returns an object you keep a reference to, then import the block
  and flip `.matches` in each test. `test/header.test.js` does this to cover
  the desktop and mobile keyboard/focus paths.
- **jsdom never fires stylesheet `load` events**, so `loadCSS()` waits
  forever. Before decorating anything that loads CSS (such as `widget`), put a
  `<link>` with that exact `href` in `<head>`; `loadCSS` then resolves at once.
- **Real modules for dynamic `import()`:** point `window.hlx.codeBasePath` at
  `new URL('./fixtures', import.meta.url).href` and put the modules in
  `test/fixtures/` (not served; `.hlxignore` covers `test/`).
- **Timers keep the process alive.** Expose `stop()` from `decorate` and call it
  when a test ends. Also `unref()` intervals in the block.
- **Network-backed blocks** (header, footer, fragment, widget) need
  `mockFetch()` from `setup.js`. The header expects the nav fragment as three
  sibling top-level divs (brand, sections, tools), the same shape as
  `nav.plain.html`.

## Current coverage (baseline)

All 23 block files pass the per-file gate (109 tests, including 11 for the
DA library in `test/library.test.js`). Aggregate: 100% lines,
~94% branches, ~99% functions. The lowest files, still above 80%:

| file | lines | branches | funcs |
|------|-------|----------|-------|
| `contactform.js` | 100% | ~83% | 100% |
| `header.js` | 100% | ~85% | ~94% |
| `footer.js` | 100% | ~87% | 100% |

New blocks must ship at ≥ 80% per file from the start.
