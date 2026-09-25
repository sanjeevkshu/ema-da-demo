# DA-safe authoring rules — preventing local≠published drift

The recurring failure class in this migration: a page looked correct on the
local `aem up` server but rendered differently on the published
`{branch}--{repo}--{owner}.aem.page` host. Root cause: the **Document Authoring
(DA) content pipeline transforms authored HTML** in ways the local server does
not. These rules make future Figma→EDS migrations produce identical local and
published output.

## The DA/authoring traps that bit us

1. **Inline `class` attributes on content elements are stripped.**
   `<a class="button primary">` / `<p class="pdp-price">` lose their class on
   publish. → Never rely on authored classes in content. Use semantic markup
   (`<strong>`/`<em>`-wrapped links → decorateButtons) and assign block-internal
   classes in the block's JS (from DOM position/content).

2. **A block only survives with `block › row › cell(s)` structure.**
   `<div class="foo"><div>…</div></div>` (single cell) or
   `<div class="foo"><div>a</div><div>b</div></div>` (cells with no row wrapper)
   → DA drops the `foo` class and flattens the content. ALWAYS author:
   `<div class="foo"><div>` (row) `<div>cell</div><div>cell</div>` `</div></div>`.
   Read cells as `block.firstElementChild.children`; put block grid on
   `.foo > div`.

3. **Structural wrapper `<div>`s inside default content are flattened**, and a
   fragment can be split into multiple sections. Nested blocks (a block inside
   another block's cell, e.g. `schedule` inside `columns`) are NOT decorated —
   only top-level blocks run their JS. → Style such structures against the flat
   published DOM (e.g. `:nth-child(3n+…)` cycling), or build structure in block
   JS which runs post-delivery.

4. **DA source API needs a full HTML document** (`<body><header></header>
   <main>…</main><footer></footer></body>`), not the bare `.plain.html`
   fragment. Uploading a fragment stores an empty page.

5. **Every top-level `<div>` in `.plain.html` is a section.** A block has to
   sit *inside* one: `<div><div class="carousel">…</div></div>`. Writing
   `<div class="carousel">` at the top level turns the class into a section
   class (`section carousel`) and the block never decorates.

6. **One missing `</div>` merges every section after it.** The unclosed section
   swallows the ones that follow: they lose their own section-metadata styles,
   take on the parent's, and their blocks render unstyled. This hit the home
   page ("What they are saying" rendered plain) and then `/discover`, because
   the same columns snippet was copied between generators. Before publishing,
   check that `<div` and `</div>` counts match and that the rendered
   `main > .section` count equals the number of authored sections:

   ```sh
   for f in content/*.plain.html; do
     o=$(grep -o '<div' "$f" | wc -l); c=$(grep -o '</div>' "$f" | wc -l)
     [ "$o" = "$c" ] || echo "UNBALANCED $f ($o open / $c close)"
   done
   ```

   A zero net count is not enough: an extra close later in the file can cancel
   a missing one earlier. When a page looks wrong, count each section separately.

## Non-negotiable verification step

**Do the final measured verification on the published `…aem.page` URL, never
only on local `aem up`.** Every defect above was invisible locally.

Automated gate (run after publish, before sign-off): for each page compare the
**authored** block classes to the **published** block classes — they must match.

```sh
# authored vs published block-class audit (must MATCH per page)
for slug in <pages>; do
  authored=$(grep -oE 'class="(hero|cards|columns|…)[^"]*"' content/$slug.plain.html | ...)
  published=$(curl -s --compressed "https://main--$repo--$owner.aem.page/$slug.plain.html" | grep -oE 'class="…"' | ...)
  [ "$authored" = "$published" ] || echo "DROPPED BLOCKS on $slug"
done
```

Also: `curl` must use `--compressed` when grepping deployed CSS/JS, or you grep
gzipped bytes and get false "not deployed" negatives.

## Publish lifecycle (don't stop at preview)

Uploading to DA + calling `admin.hlx.page/preview/...` puts content on the
PREVIEW tier only. Going live needs the **publish** step
(`admin.hlx.page/live/...`) — and code needs the **PR merged to `main`**. Until
both happen, `…aem.live/<page>` returns 404 and the UI sync counter stays > 0.

Order: upload source (`admin.da.live/source/{org}/{site}/{path}.html`) →
preview (`POST admin.hlx.page/preview/{org}/{site}/main/{path}`) → live
(`POST admin.hlx.page/live/…`) → block-class audit. The `da-publish` skill
(`.claude/skills/da-publish/SKILL.md`) has the full runbook.

## Reading DA responses correctly

Each of these was misread at least once during a publish:

- **`201 Created` is success.** New assets return 201; overwritten documents
  return 200. Accept both.
- **`401` from `content.da.live` does not mean the file is missing.** Reads there
  need auth too. Check existence with a `GET` on `admin.da.live/source/...`,
  the same auth path the upload used.
- **A `401` on upload means the credential opt-in is off**, or it was just
  enabled and hasn't taken effect yet. It applies from the next turn. Never ask
  for a token in chat.
- **DA rewrites image references** to content-addressed `./media_<hash>.png`.
  Images published seconds ago can fail to load until the media is optimized.
  Before reporting broken images, re-check the `media_` URLs on the live host
  about a minute later.
- **The home page is `/`.** `/index` returns 404 on `.aem.live`, and that is expected.

## Local preview limits

- Pages are served at `/content/<slug>` with no extension. `/content/<slug>.html`
  returns 404. New pages render without restarting the server.
- The header and footer fetch `/nav` and `/footer` from the site root, which the
  local server can serve from the published `--url` host. **Local preview can't
  confirm nav/footer edits.** Verify them on `.aem.page` after publishing.
