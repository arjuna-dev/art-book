# Art Book Vue

Interactive studio for previewing and exporting the art book. Powered by Vue 3, Vite, and Paged.js.

## Setup

```sh
npm install
```

Install Playwright's Chromium browser (required for PDF export):

```sh
npx playwright install chromium
```

## Running

### Preview in browser

```sh
npm run dev
```

Opens the interactive studio at `http://localhost:5173`. The book renders as a paginated Paged.js preview. Use the studio controls to adjust per-artwork templates, colors, and backgrounds.

### Run tests

```sh
npm test
```

Runs the Vitest suite for the pure layout-state logic. Use `npm run test:watch` while iterating.

### Export PDF

```sh
npm run export:pdf
```

Starts Vite internally, opens Chromium via Playwright, waits for pagination to complete, then exports `book-export.pdf` in the project root.

#### Page size

Set the `ART_BOOK_PAGE_SIZE` environment variable to control the output dimensions:

| Value | Size |
|---|---|
| `small-landscape` | 9in × 7in (default) |
| `a4` | 210mm × 297mm |
| `trade` | 6in × 9in |
| `square` | 8in × 8in |
| `a5` | 148mm × 210mm |

```sh
ART_BOOK_PAGE_SIZE=a4 npm run export:pdf
```

## Content

- **`../list.json`** — source of truth for all artists and art pieces
- **`../art-book-layout.json`** — per-artwork layout state (template, text color, background color); export from the studio UI and commit to persist changes
- **`../generated-images/`** — artwork images resolved by Vite at build time via `import.meta.glob`

## Key files

```
src/
  App.vue                   main studio and book HTML generator
  templates/
    artworkTemplates.js     template render functions and registry
  styles/
    book.css                print layout (Paged.js rules, @page, breaks)
    screen.css              studio UI styles
scripts/
  export-pdf.mjs            Playwright PDF export script
```
