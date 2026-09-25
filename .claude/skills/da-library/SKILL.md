---
name: da-library
description: Rebuild and upload the Document Authoring block and template library (docs/library) from the site's own blocks and pages. Use without being asked whenever a block is added, removed or renamed, a block variant is added or changed, a block's content model changes, or a page is added whose mix of blocks is new (a new page type). Also use for "update the library", "add X to the library", "templates", or when test/library.test.js fails.
---

# DA library runbook (sanjeevkshu / ema-da-demo)

The library is what authors see in DA under **Blocks** and **Templates**. It is
generated, not hand-edited:

- `library.config.json` holds the author-facing name and description of every
  block and variant, the section styles, and the template names.
- `build-library.mjs` takes one real example of each supported variant from
  `content/*.plain.html` and groups pages into page types (the same ordered set
  of blocks = one type). The first named page of each type becomes its template.
- `test/library.test.js` fails CI when a block in `blocks/`, or a variant its
  CSS/JS styles, has no entry in the config.

## When it runs (no request needed)

Run it in the same change as any of these, and include the upload in the PR's
test steps:

| Change | Do |
|--------|----|
| New block | Add it to `blocks` (name + description) or `excludedBlocks` (with why) |
| New variant (`.block.variant` in CSS or `classList.contains('x')` in JS) | Add `variants.x` |
| Changed rows/cells | Update the description; it tells authors what goes in each cell |
| Block removed or renamed | Update the config key; delete the old DA doc only after asking |
| Page with a new mix of blocks | Name it in `templates`, keyed by the page slug |
| New section style in `styles/` | Add it to `sectionStyles` and the section-metadata description |

## 1. Update the config, then check it

```sh
node .claude/skills/da-library/build-library.mjs --check
```

## 2. Fetch the page sources, then build

Build from the DA source of each page, not from `content/`. DA stores images as
`https://content.da.live/...` URLs. The local mirror rewrites them to
`/media-da/...` paths, which break in the DA editor. Reading the source also
picks up author edits made since the mirror last synced.

```sh
SRC=https://admin.da.live/source/sanjeevkshu/ema-da-demo
D=migration-work/da-library-source; rm -rf "$D"; mkdir -p "$D"
for f in content/*.plain.html; do
  s=$(basename "$f" .plain.html); case $s in nav|footer) continue;; esac
  printf '%s ' "$s"; curl -s -o "$D/$s.html" -w '%{http_code}\n' "$SRC/$s.html"
done
node .claude/skills/da-library/build-library.mjs
```

A page created in DA that isn't in `content/` yet is missed. Check the list
with `https://admin.da.live/list/sanjeevkshu/ema-da-demo` if in doubt.

This writes `migration-work/da-library/` (local only), which holds the block and
template docs, `blocks.json`, `templates.json` and `report.json`. It prints the
page types and warnings:

- `no example on any page` means the block was left out. Add an `example`
  (rows of cells, as HTML) to its config entry, or author it on a page first.
- `supported in code but no page uses it` is informational. Add an example if
  authors should see the variant.

Check that every generated doc is balanced:

```sh
for f in migration-work/da-library/docs/library/*/*.html; do
  o=$(grep -o '<div' "$f" | wc -l); c=$(grep -o '</div>' "$f" | wc -l)
  [ "$o" = "$c" ] || echo "UNBALANCED $f"
done
```

## 3. Upload to DA

These uploads need the Settings → LLM Permissions opt-in. A `401` means it's
off; never ask for a token in chat.

```sh
SRC=https://admin.da.live/source/sanjeevkshu/ema-da-demo
cd migration-work/da-library
for f in docs/library/blocks/*.html docs/library/templates/*.html; do
  printf '%s ' "$f"; curl -s -X POST -F "data=@$f;type=text/html" "$SRC/$f" -w '%{http_code}\n' -o /dev/null
done
for f in docs/library/blocks.json docs/library/templates.json; do
  printf '%s ' "$f"; curl -s -X POST -F "data=@$f;type=application/json" "$SRC/$f" -w '%{http_code}\n' -o /dev/null
done
```

`200` or `201` is success. Don't preview or publish the library docs: DA reads
them from the source, and they'd only add noise to the sitemap and search.

The DA config (`https://da.live/config#/sanjeevkshu/ema-da-demo/`, `library`
tab) already points Blocks and Templates at these two sheets. Only change it if
the paths change.

## 4. Verify

1. `GET $SRC/docs/library/blocks.json` and `templates.json`: row counts match
   `report.json`.
2. `GET $SRC/docs/library/blocks/<name>.html` for each changed block returns 200
   and contains `library-metadata`.
3. List `$SRC` with `https://admin.da.live/list/sanjeevkshu/ema-da-demo/docs/library/blocks`.
   Docs that aren't in the sheet are stale. Report them; delete only if the user agrees.
4. Ask the user to open any page in DA, then Blocks and Templates, and confirm
   the new entries show.

## 5. Report

List the blocks and templates added or changed, the upload status codes, any
warnings from step 2, and any stale docs found in step 4.
