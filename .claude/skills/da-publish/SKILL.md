---
name: da-publish
description: Publish PULSE content (pages, nav/footer fragments, images) from content/*.plain.html to Document Authoring, then preview, publish live, and audit that no blocks were dropped. Use when asked to upload, publish, push content to DA, or "run the publish queue".
---

# DA publish runbook (sanjeevkshu / ema-da-demo)

Content is not in git. `content/` is a symlink to the DA content source, so
"commit and push content" means this runbook, not `git push`. Code ships
separately, by merging to `main`.

Set these once per shell:

```sh
ORG=sanjeevkshu; SITE=ema-da-demo
SRC=https://admin.da.live/source/$ORG/$SITE
ADMIN=https://admin.hlx.page
```

## 0. Preconditions

1. **Credentials.** Probe with a single upload (step 2). A `401` means the
   Settings → LLM Permissions opt-in for Adobe/DA is off, or was enabled this
   turn and applies from the next one. Tell the user; never ask for a token in chat.
2. **Structure.** Run for every page you're about to publish:
   - `<div` and `</div>` counts match, and each section is balanced on its own
     (rule 6 in `reference/da-authoring-rules.md`).
   - Every block is nested inside a top-level section div (rule 5).
   - Blocks use `block › row › cell(s)` (rule 2).
3. **Render check.** Load `http://localhost:3000/content/<slug>` and confirm
   `main > .section` count equals the authored section count. Local preview
   can't check nav/footer; those get verified after step 4.

## 1. Build full documents

DA stores an empty page if given a bare fragment. Wrap it:

```sh
mkdir -p migration-work/da-docs
for slug in <slugs>; do
  { printf '<body>\n  <header></header>\n  <main>\n'
    cat "content/$slug.plain.html"
    printf '\n  </main>\n  <footer></footer>\n</body>\n'; } > "migration-work/da-docs/$slug.html"
done
```

`nav` and `footer` are wrapped the same way and published at `/nav` and `/footer`.

## 2. Upload

```sh
# documents
curl -s -X POST -F "data=@migration-work/da-docs/$slug.html;type=text/html" \
  "$SRC/$slug.html" -w '%{http_code}\n' -o /dev/null
# images: send the real content type (image/png, image/jpeg, image/svg+xml)
curl -s -X POST -F "data=@content/media-da/$dir/$file;type=image/png" \
  "$SRC/media-da/$dir/$file" -w '%{http_code}\n' -o /dev/null
```

**Success is `200` or `201`.** New assets return 201.
To confirm a file exists, `GET $SRC/<path>` and expect 200. Don't check
through `content.da.live`: it also answers 401 to reads, which says nothing
about whether the file is there.

## 3. Preview, then live

```sh
curl -s -X POST "$ADMIN/preview/$ORG/$SITE/main/$slug" -w '%{http_code}\n' -o /dev/null
curl -s -X POST "$ADMIN/live/$ORG/$SITE/main/$slug"    -w '%{http_code}\n' -o /dev/null
```

The home page uses path `index` in these calls, but it is **served at `/`**.
`/index` returns 404 on `.aem.live`, and that is correct. Only go live if the
user asked for it; preview-only is a valid stopping point.

## 4. Verify on the published site (non-negotiable)

1. **Block-class audit.** For each page, compare the authored and published
   block classes. They must match:

   ```sh
   pat='class="(carousel|productgrid|cards|columns|testimonials|specs|hero|pdp)[^"]*"'
   a=$(grep -oE "$pat" content/$slug.plain.html | sort -u)
   p=$(curl -s --compressed "https://main--$SITE--$ORG.aem.page/$slug.plain.html" | grep -oE "$pat" | sort -u)
   [ "$a" = "$p" ] && echo "MATCH $slug" || echo "DROPPED BLOCKS on $slug"
   ```

2. **Pages return 200** on `https://main--$SITE--$ORG.aem.live/<slug>`
   (home: `/`), and `nav.plain.html` and `footer.plain.html` return 200.
3. **Images.** DA rewrites image references to `./media_<hash>.png`. Freshly
   published images can fail in the browser for a minute or so. Before
   reporting a broken image, curl each `media_` URL on the live host. If they
   return 200, reload and re-check `naturalWidth`.
4. **Visual check** at 1440px width. The default viewport is narrow, and
   grids look broken at that width.

## 5. Report

List docs and images uploaded, preview/live codes, the audit result per page,
and live URLs. If any step failed, say which one and include the status code.
