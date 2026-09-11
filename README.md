# Dr. Vincent Sam Jebadurai — personal brand platform

**Building Knowledge. Inspiring People. Serving with Purpose.**
Build · Inspire · Serve

A static site with no runtime dependencies. Data in `assets/data/*.json` is the single
source of truth; `tools/build.js` generates every page from it.

---

## Preview it locally

Every internal link is relative and ends in `index.html`, so the site works with **no
server at all** — just open `index.html` in a browser.

For a closer match to production (clean `/about/` style URLs in the address bar), serve it:

```bash
python3 -m http.server 8000
# then open http://127.0.0.1:8000/
```

> The site loads photographs from Unsplash and typefaces from Google Fonts, so the first
> load needs an internet connection. Layout and content work offline; only images and
> the two webfonts will be missing.

---

## Changing content

**Never edit the generated `index.html` files — they are overwritten on every build.**

| To change | Edit | Then |
|---|---|---|
| A publication, patent, project, talk, research area | `assets/data/*.json` | `node tools/build.js` |
| Page prose | `content/<route>.html` | `node tools/build.js` |
| Page title / meta description / hero | `assets/data/pages.json` | `node tools/build.js` |
| Navigation, footer, metrics, profile links | `assets/data/site.json` | `node tools/build.js` |
| An article's body | `content/articles/<slug>.html` | `node tools/build.js` |

```bash
node tools/build.js     # regenerate the site   (Node >= 18, no npm install needed)
node tools/check.js     # verify links, headings, alt text, placeholders, data integrity
```

`tools/check.js` exits non-zero on failure, so it can gate a deploy.

### Replacing the photographs

`imginf.csv` lists every image slot with its required dimensions and a brief describing
what the photograph should show. To replace one:

1. Save the image as `assets/img/<slot_id>.jpg` (the slot id is the first CSV column).
2. Run `node tools/build.js`.

The generator uses the local file whenever it exists and falls back to the placeholder
otherwise, so images can be replaced one at a time.

---

## Structure

```
assets/data/     JSON source of truth (publications, patents, projects, research, …)
content/         hand-written page prose, wrapped by the generator
tools/build.js   generator — pages, sitemap, search index, imginf.csv, redirects
tools/check.js   verification suite
assets/css/      one stylesheet
assets/js/       one script (nav, publication filters, search, copy-citation)
assets/img/      drop replacement photographs here
URL-MANIFEST.txt generated route map, including every redirect
```

## Information architecture

`/` · `/about/` · `/academia/` · `/research/` · `/innovation/` · `/publications/` ·
`/projects/` · `/leadership/` · `/institution-relations/` · `/speaking/` · `/ministry/` ·
`/service/` · `/media/` · `/articles/` · `/search/` · `/contact/`

The V0.6 persona routes (`/professor/`, `/researcher/`, `/motivational-speaker/`,
`/preacher/`, `/sermons/`, `/philanthropist/`, `/talks/`,
`/manager-institution-relations/`, `/patents/`) are preserved as redirect stubs, so no
old address 404s. See `URL-MANIFEST.txt`.

## Editorial rules encoded in this repo

- Publication titles, author order and journal names are reproduced **exactly**; no DOI
  or indexing is ever inferred.
- Citation metrics are always rendered with their as-of date (Scopus, August 2026).
- Records that cannot be evidenced are omitted rather than shown with a caveat.
- First person for About, Ministry and philosophy; neutral academic voice for
  publications, patents, projects and credentials.
