# DA-safe authoring rules — preventing local≠published drift

The recurring failure class in this migration: a page looked correct on the
local `aem up` server but rendered differently on the published
`{branch}--{repo}--{owner}.aem.page` host. Root cause: the **Document Authoring
(DA) content pipeline transforms authored HTML** in ways the local server does
not. These rules make future Figma→EDS migrations produce identical local and
published output.

## The 4 DA transformations that bit us

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
