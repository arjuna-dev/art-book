# Art Book Project Guide

This repo contains an interactive Vue studio for generating a printable art book. The important project lives in `art-book-vue/`.

## Stack Map

Materially important:

- Vue 3: used as the shell for the interactive studio. The book itself is not primarily rendered as Vue components. The key concept is that `bookHtml` is a computed string, and `pagedOutput` is the DOM mount target where Paged.js writes the paginated preview.
- Vite: runs the dev server and resolves assets. Generated images are discovered through `import.meta.glob("../../generated-images/**/*.{png,jpg,jpeg,webp}")`, so image availability and paths are tied to Vite module resolution.
- Paged.js: the core print engine. It takes one large HTML document plus print CSS, paginates it according to CSS page rules, and writes a paginated preview DOM.
- Playwright: used for PDF export automation. It starts Chromium, opens the Vite app, waits for the app-level readiness flag, then calls Chromium PDF export.
- `book.css`: effectively the real layout engine. Most book template behavior lives in CSS, not Vue.
- `list.json`: the source of truth for book content. Any template system should preserve a clean mapping from this data into printable sections.
- `art-book-layout.json`: repo-level durable layout state for per-artwork template, text color, and background color choices. The static frontend imports this file and can export an updated JSON snapshot for committing.

Useful but mostly interface-level:

- `lucide-vue-next`: icon library for the studio UI.
- `shadcn-vue`: UI component layer for the interactive controls.
- `class-variance-authority`, `clsx`, `tailwind-merge`: class composition utilities for studio UI consistency. They are not central to the book rendering pipeline unless reused in template controls.

## Paged.js Integration

The current pattern is:

```js
const previewer = new Previewer()

await previewer.preview(
  bookHtml.value,
  [bookCssUrl],
  pagedOutput.value
)
```

Conceptually, `Previewer.preview()`:

1. Takes the complete book HTML string as the source document.
2. Loads the provided CSS file or files, especially `book.css`.
3. Applies paged media rules such as `@page`, page breaks, named pages, margins, counters, and overflow handling.
4. Generates a paginated DOM preview inside `pagedOutput.value`.

Vue does not render pages. Vue generates a single HTML string. Paged.js interprets that HTML as a print document and splits it into pages.

The readiness flag matters:

```js
window.__ART_BOOK_PAGED_READY__ = true
```

This should be set only after pagination finishes. The PDF export script depends on this flag.

PDF export flow:

1. `scripts/export-pdf.mjs` starts Vite.
2. Playwright opens the local app in Chromium.
3. The app builds `bookHtml`.
4. Paged.js paginates into `pagedOutput`.
5. The app sets `window.__ART_BOOK_PAGED_READY__ = true`.
6. Playwright waits for that flag.
7. Playwright runs:

```js
page.pdf({
  printBackground: true,
  preferCSSPageSize: true
})
```

Keep `preferCSSPageSize: true`; Chromium should respect the `@page` size from CSS instead of imposing a default PDF size.

## Current Template Model

Templates are plain HTML string factories plus CSS classes. They are not components. Reusable artwork templates live in `art-book-vue/src/templates/artworkTemplates.js`; `App.vue` orchestrates data, selected modes, and Paged.js preview.

Current template ids:

- `all`
- `spread-image`
- `artist-profile`
- `panorama-text`
- `full-bleed`
- `padded-plate`

Important rendering functions:

- `renderArtistSection()`: builds an artist-level section.
- `renderArtistProfile()`: builds artist biography or profile pages.
- `renderPieceTemplates()`: chooses how artworks are rendered by looking up `artworkTemplates`.
- `artworkTemplates["spread-image"].render`: builds a spread-style image layout.
- `artworkTemplates["panorama-text"].render`: builds a panorama plus text layout.
- `artworkTemplates["full-bleed"].render`: builds a full-page or full-bleed artwork page.
- `artworkTemplates["padded-plate"].render`: builds a plate layout with padding.
- `renderArtworkInfo()` in `artworkTemplates.js`: builds metadata or caption content.

Important CSS page names:

- `@page default`
- `@page cover`
- `@page intro`
- `@page plate`

Important CSS classes:

- `cover-template`
- `intro-template`
- `artist-profile-template`
- `artwork-template`
- `spread-image-template`
- `full-bleed-template`
- `padded-plate-template`
- `panorama-template`

A template is currently:

- template id
- render function
- section class names
- `book.css` layout rules
- Paged.js pagination behavior

## Artwork Inclusion

Each art piece in `list.json` has an `include_in_book` boolean. The renderer treats only `false` as excluded, so missing values remain backward-compatible and render by default.

Use the repeatable migration script when new pieces are added:

```sh
python3 scripts/add_include_in_book.py
```

Useful options:

```sh
python3 scripts/add_include_in_book.py --default false
python3 scripts/add_include_in_book.py --overwrite --default true
```

Do not hand-edit this flag across the whole file when a script run will do it consistently.

## Repo-Level Layout State

Per-artwork page design choices are stored in `art-book-layout.json`:

```json
{
  "version": 1,
  "defaults": {
    "artworkTemplate": "padded-plate",
    "textColor": "black",
    "backgroundColor": "paper"
  },
  "artworks": {
    "Artist Name::Artwork Name": {
      "template": "full-bleed",
      "textColor": "white",
      "backgroundColor": "black"
    }
  }
}
```

This preserves static-site serving. The browser cannot write back to the repo without a server, so the frontend designer exports an updated `art-book-layout.json` file that can be committed. A Node write server can be added later as an optional development convenience, but it should not become required for previewing or exporting the static book.

## Grid Color System

Book pages can combine text and background colors independently through CSS classes:

- background: `bg-paper`, `bg-white`, `bg-black`, `bg-red`, `bg-blue`, `bg-orange`
- text: `text-paper`, `text-white`, `text-black`, `text-red`, `text-blue`, `text-orange`

These classes set `--paper`, `--ink`, and `--folio-color` in `book.css`. New templates should accept the combined theme class string from the renderer instead of hardcoding color pairs.

## Adding A Template

Natural extension points:

1. Add a new template id.
2. Add a render function that returns a section string.
3. Add or reuse a CSS class in `book.css`.
4. Add page assignment behavior through CSS, usually with `page: plate`.
5. Update the selection logic in `renderPieceTemplates()`.
6. Test both the screen preview and exported PDF.

Before adding a new layout, identify:

- template id
- required artwork fields
- generated HTML section shape
- CSS class
- named page
- break behavior
- caption behavior
- export expectations

Add new templates first as string renderers unless there is a strong reason to refactor.

## Recommended Evolution

### Approach A: String Template Registry

This is the smallest change and fits the current repo best.

```js
const artworkTemplates = {
  "full-bleed": {
    label: "Full bleed",
    pageName: "plate",
    render: renderFullBleed,
    supports: {
      captions: false,
      twoPage: false
    }
  },
  "padded-plate": {
    label: "Padded plate",
    pageName: "plate",
    render: renderPaddedPlate,
    supports: {
      captions: true,
      twoPage: false
    }
  },
  "spread-image": {
    label: "Spread image",
    pageName: "plate",
    render: renderTwoPageImage,
    supports: {
      captions: false,
      twoPage: true
    }
  }
}
```

Then `renderPieceTemplates()` becomes mostly lookup and orchestration instead of a growing conditional block.

Good fit when:

- minimal refactoring is preferred
- CSS remains the main layout system
- Paged.js-friendly HTML control matters
- templates are mostly static print structures

Watch out for:

- string escaping must be disciplined
- complex layouts can become hard to read
- reusable subparts need helper functions, such as captions, artwork metadata, image tags, and page wrappers

Recommended structure:

```text
src/
  templates/
    registry.js
    helpers.js
    artwork/
      fullBleed.js
      paddedPlate.js
      spreadImage.js
      panoramaText.js
    artist/
      artistProfile.js
      artistSection.js
```

### Approach B: Vue Components Rendered To Static HTML

Each template becomes a Vue component, but Paged.js still receives a static HTML string.

Flow:

```text
list.json
to Vue template component tree
to static HTML string
to Paged.js Previewer.preview()
to paginated DOM
```

This likely requires server-side rendering utilities or a controlled static render step. The benefit is that templates become easier to compose and test as components.

Good fit when:

- templates need richer conditional logic
- visual maintainability is a priority
- studio UI and print templates should share components or props
- many layouts need reusable parts

Watch out for:

- more setup complexity
- asset path handling becomes more sensitive
- Paged.js still needs final static HTML and CSS, so dynamic Vue behavior inside book content is irrelevant after render
- hydration is unnecessary and can be counterproductive for print output

A sensible component shape:

```vue
<ArtworkTemplate
  :artwork="artwork"
  :artist="artist"
  layout="full-bleed"
/>
```

The output should still be plain print HTML before Paged.js sees it.

### Approach C: JSON Schema Driven Template Selection

Templates are described by data. Rendering still happens through either strings or components.

```json
{
  "template": "padded-plate",
  "imageFit": "contain",
  "caption": "bottom",
  "page": "plate",
  "bleed": false,
  "metadata": ["title", "year", "medium"]
}
```

Good fit when:

- non-developers should configure book layouts
- many books share the same engine but use different layout recipes
- layout presets should live in `list.json` or a companion config file
- validation before rendering is needed

Watch out for:

- the schema must not become a second programming language
- some layouts will still need custom renderers
- validation becomes important
- debugging becomes harder if template decisions are too indirect

Recommended hybrid: use Approach A now, with a registry that can later accept schema options.

```js
renderTemplate({
  templateId: artwork.template ?? defaultTemplate,
  artwork,
  artist,
  options: artwork.layoutOptions ?? {}
})
```

## Paged.js Constraints

### Two-Page Spreads

Two-page spreads are tricky because Paged.js paginates content naturally. A spread template must deliberately control page breaks.

Check:

- a spread starts on the intended left or right page
- the image may need two coordinated pages rather than one oversized element
- CSS forces page breaks before and after the spread section
- blank page insertion is handled if the visual depends on facing pages
- exported PDF is inspected as spreads, not only as single pages

Useful pattern:

```css
.spread-image-template {
  break-before: page;
  break-after: page;
}
```

For true left and right page control, use named pages and left or right page selectors where supported.

### Page-Specific CSS

Named pages are assigned from elements using CSS like:

```css
.cover-template {
  page: cover;
}
```

Then `@page cover` defines the physical page behavior.

Gotchas:

- page assignment applies based on the element that starts the page
- nested page names can behave unexpectedly
- if content overflows into following pages, continuation pages may inherit or lose intended page styling depending on structure
- keep major book sections as top-level section elements

### Overflow

Paged.js is not a general layout miracle worker. If a section has too much fixed-height content, it may overflow, clip, or create surprising breaks.

Common risky patterns:

- fixed-height containers
- absolutely positioned captions
- images without explicit sizing rules
- long artist bios inside a layout designed for one page
- full-bleed images with metadata placed in the same page box
- CSS grid layouts that do not fragment gracefully

Safer patterns:

- explicit image constraints with `object-fit`
- separate artwork pages from metadata pages when needed
- avoid relying on viewport units for print layout
- prefer page-sized sections only when the content cannot grow
- add debug styles for page boundaries while developing

## Print Export Notes

Playwright PDF export depends on Chromium print behavior, not only Paged.js.

Important points:

- `printBackground: true` is required for backgrounds and full-bleed visual areas.
- `preferCSSPageSize: true` should stay enabled.
- the readiness flag must only be set after fonts, images, and Paged.js pagination are complete.
- if images load late, the PDF can export before layout stabilizes unless image readiness is handled.
- Vite asset paths must resolve correctly in the Playwright browser session.
- review the PDF separately from the interactive preview.

A more robust export readiness condition would include:

- data loaded
- images resolved
- `bookHtml` computed
- Paged.js preview complete
- fonts ready
- optional second animation frame passed

## Offline Coding Checklist

Start in `art-book-vue/src/App.vue`.

Find:

- the computed `bookHtml`; this is the main book document generator
- `renderPagedPreview()`; this bridges Vue state to Paged.js
- where `bookCssUrl` is created or imported; this is the CSS file passed into Paged.js

Inspect:

- `art-book-vue/src/styles/book.css`; treat this as the primary print layout source
- `art-book-vue/src/styles/screen.css`; this controls the studio UI and Paged.js preview grid, not exported print layout
- all render functions listed in this guide
- how `list.json` is loaded and normalized
- how generated image paths are matched through `import.meta.glob`

Implementation guidance:

- keep sections top-level and predictable; Paged.js behaves better with clean document structure
- keep studio UI concerns out of print templates
- keep interactive UI, book HTML generation, and print CSS as separate layers
- for larger evolution, introduce a template registry before introducing Vue component-driven print rendering

Test in this order:

1. Vite preview renders.
2. Paged.js preview completes.
3. `window.__ART_BOOK_PAGED_READY__` is set.
4. PDF export completes.
5. PDF page size is correct.
6. Full-bleed pages and spreads look correct.
7. Captions and bios do not overflow.
