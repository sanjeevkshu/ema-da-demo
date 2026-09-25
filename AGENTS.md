# AGENTS.md

Edge Delivery Services. Read a block first. Omissions are in the repo or known.

## Avoid
- `scripts/aem.js` is vendored. Never edit.
- Markup comes from the backend. `curl localhost:3000/x.plain.html` first.
- `buildAutoBlocks` rewrites content before your block runs.
- Authors omit and add cells. Decorate defensively.
- No build step; devDependencies only.
- Scope CSS to `.blockname`; `-wrapper`/`-container` are section classes.
- `fragment/fragment.js` is the only cross-block import. Otherwise use `/scripts/`.
- Check `aem.js` exports before importing. There is no `fetchPlaceholders`.
- In `.plain.html`, each top-level `<div>` is a section; blocks go inside one.
  One missing `</div>` merges every later section, and their styles break.

## Outdated
- `fstab.yaml`, `helix-query.yaml`, `paths.json` are retired. Config lives at tools.aem.live.

## Remember
- `npx -y @adobe/aem-cli up`: local code, previewed content.
- Merging `main` ships code; content publishes separately.
- A PR without a `{branch}--{repo}--{owner}.aem.page/{path}` link is rejected
  (the `aem-psi-check` bot fails it).
- Branches: cut from `main`, PR into `develop`, and promote with merge commits.
  Squash merges make `main` and `develop` diverge again.
- Keep branch names ≤37 chars. `{branch}--ema-da-demo--sanjeevkshu` must fit a
  63-char DNS label, or the preview host won't start.
- Content isn't in git. Publish with `.claude/skills/da-publish`. Local
  preview can't show nav/footer edits; verify those on the published site.
- All committed files are served. Use `.hlxignore`.
- New/changed blocks MUST ship tests at ≥80% coverage (lines/branches/funcs)
  **per file**. `npm run test:coverage` is a CI gate, and a block no test
  loads fails it. See `reference/testing-and-coverage.md`.
- Skills: `/plugin marketplace add adobe/skills`, then `aem-edge-delivery-services` (24 skills, incl. `docs-search`).
