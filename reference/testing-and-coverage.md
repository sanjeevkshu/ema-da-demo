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
- Command: `npm run test:coverage`
  - `--test-coverage-lines=80 --test-coverage-branches=80
    --test-coverage-functions=80` → non-zero exit below any threshold.
  - scoped to `blocks/**/*.js` (excludes `test/**`).
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
- **Module-scoped `matchMedia` handles can't be switched per test.**
  `header.js` reads `isDesktop` once at load, so its desktop/mobile keyboard
  branches stay uncovered. That is why `header.js` sits near 72% lines. To
  make that logic testable, read the query inside functions.
- **Timers keep the process alive.** Expose `stop()` from `decorate` and call it
  when a test ends. Also `unref()` intervals in the block.
- **Network-backed blocks** (header, footer, fragment, widget) need
  `mockFetch()` from `setup.js`. The header expects the nav fragment as three
  sibling top-level divs (brand, sections, tools), the same shape as
  `nav.plain.html`.

## Current coverage (baseline)

All 23 blocks now have functional tests (81 tests total). Aggregate:

| scope     | lines | branches | funcs |
|-----------|-------|----------|-------|
| all files | ~93%  | ~92%     | ~92%  |

Most blocks sit at 100%. A few remain partially covered where behaviour is
hard to reach headlessly:

- `header.js` — mobile/desktop toggle helpers depend on a module-scoped
  `matchMedia` handle captured at load, so some keyboard/focus branches aren't
  exercised. Decorate, dropdown detection, hamburger toggle and Escape are.
- `widget.js` / `fragment.js` — the dynamic-`import()` failure paths and a
  couple of guard branches.

When you touch any of these, raise their coverage. New blocks must ship at
≥ 80% from the start.
