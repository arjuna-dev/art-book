<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { Previewer } from "pagedjs";
import artList from "../../list.md?raw";

const pageSize = ref("trade");
const renderMode = ref("preview");
const status = ref("Preparing pages");
const pagedOutput = ref(null);

const pageSizes = {
  trade: {
    label: "Trade 6 x 9 in",
    className: "size-trade",
    width: "6in",
    height: "9in",
  },
  square: {
    label: "Square 8 x 8 in",
    className: "size-square",
    width: "8in",
    height: "8in",
  },
  a5: {
    label: "A5 148 x 210 mm",
    className: "size-a5",
    width: "148mm",
    height: "210mm",
  },
};

const artworks = computed(() => parseArtworkMarkdown(artList).slice(0, 14));

const selectedPageSize = computed(() => pageSizes[pageSize.value]);

const bookHtml = computed(() => {
  const entries = artworks.value
    .map((artwork, index) => renderArtworkSpread(artwork, index))
    .join("");

  return `
    <section class="book-section cover-template">
      <p class="kicker">Working catalogue</p>
      <h1>Speculative Works</h1>
      <p class="cover-note">A print-first art book assembled from project notes, generated studies, and installation concepts.</p>
    </section>
    <section class="book-section intro-template">
      <h2>Format Study</h2>
      <p>This Vue and Paged.js workspace treats pages as designed sections, while CSS <code>@page</code> owns the physical sheet: trim size, margin boxes, page counters, and print behavior.</p>
      <p>Use section classes for templates such as cover, chapter opener, artwork spread, notes, and image plates. Use named <code>@page</code> rules when those templates need different margins or folios.</p>
    </section>
    ${entries}
  `;
});

function parseArtworkMarkdown(markdown) {
  const blocks = markdown.split(/\n(?=###\s+)/).filter((block) => block.includes("###"));

  return blocks.map((block) => {
    const titleMatch = block.match(/^###\s+-?\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled";
    const body = block
      .replace(/^###\s+-?\s*.+$/m, "")
      .trim()
      .split(/\n+/)
      .filter(Boolean)
      .join(" ");

    return {
      title,
      body: body || "Concept note pending.",
    };
  });
}

function renderArtworkSpread(artwork, index) {
  const number = String(index + 1).padStart(2, "0");
  const image = imageForIndex(index);

  return `
    <section class="book-section artwork-template">
      <div class="artwork-meta">
        <p class="artwork-number">${number}</p>
        <h2>${escapeHtml(artwork.title)}</h2>
      </div>
      <p>${escapeHtml(artwork.body)}</p>
    </section>
    <section class="book-section plate-template">
      <figure>
        <img src="${image}" alt="" />
        <figcaption>${number} / ${escapeHtml(artwork.title)}</figcaption>
      </figure>
    </section>
  `;
}

function imageForIndex(index) {
  const images = [
    new URL("../../generated-images/openai/001-kenji-fujiwara-perceptron-195x-20260419T133331Z.png", import.meta.url).href,
    new URL("../../generated-images/openai/002-kenji-fujiwara-prime-distribution-20260419T133423Z.png", import.meta.url).href,
    new URL("../../generated-images/openai/003-dr-elena-vasquez-primordial-stones-20260419T133518Z.png", import.meta.url).href,
    new URL("../../generated-images/openai/004-dr-elena-vasquez-prime-shell-spiral-20260419T133619Z.png", import.meta.url).href,
    new URL("../../generated-images/openai/005-dr-elena-vasquez-ai-fish-resurrection-20260419T133725Z.png", import.meta.url).href,
    new URL("../../generated-images/gemini/006-valentina-cienfuegos-mora-water-s-20260421T143055Z.png", import.meta.url).href,
    new URL("../../generated-images/gemini/007-valentina-cienfuegos-mora-angel-vs-capital-20260421T143119Z.png", import.meta.url).href,
    new URL("../../generated-images/gemini/008-valentina-cienfuegos-mora-cyberpunk-tenochtitlan-20260421T143146Z.png", import.meta.url).href,
    new URL("../../generated-images/gemini/009-valentina-cienfuegos-mora-zapatista-women-sculptures-20260421T143210Z.png", import.meta.url).href,
    new URL("../../generated-images/gemini/010-valentina-cienfuegos-mora-tortilla-human-20260421T143247Z.png", import.meta.url).href,
  ];

  return images[index % images.length];
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderPagedPreview() {
  if (!pagedOutput.value) return;

  window.__ART_BOOK_PAGED_READY__ = false;
  status.value = "Paginating";
  pagedOutput.value.innerHTML = "";
  updatePageSizeStyle();

  await nextTick();

  const previewer = new Previewer();
  await previewer.preview(bookHtml.value, ["/src/styles/book.css"], pagedOutput.value);

  status.value = "Paged";
  window.__ART_BOOK_PAGED_READY__ = true;
}

function updatePageSizeStyle() {
  const size = selectedPageSize.value;
  let style = document.querySelector("#art-book-page-size");

  if (!style) {
    style = document.createElement("style");
    style.id = "art-book-page-size";
    document.head.append(style);
  }

  style.textContent = `
    @page {
      size: ${size.width} ${size.height};
      margin: 20mm;
    }

    @page cover {
      size: ${size.width} ${size.height};
      margin: 0;
    }

    @page intro {
      size: ${size.width} ${size.height};
      margin: 24mm 20mm 22mm;
    }

    @page plate {
      size: ${size.width} ${size.height};
      margin: 0;
    }
  `;
}

function printBook() {
  window.print();
}

onMounted(renderPagedPreview);
</script>

<template>
  <main :class="['studio', selectedPageSize.className]">
    <aside class="studio-panel" aria-label="Book controls">
      <div>
        <p class="eyebrow">Paged.js studio</p>
        <h1>Art Book</h1>
      </div>

      <label class="field">
        <span>Page size</span>
        <select v-model="pageSize" @change="renderPagedPreview">
          <option v-for="size in pageSizes" :key="size.className" :value="Object.keys(pageSizes).find((key) => pageSizes[key] === size)">
            {{ size.label }}
          </option>
        </select>
      </label>

      <div class="segmented" aria-label="View mode">
        <button :class="{ active: renderMode === 'preview' }" type="button" @click="renderMode = 'preview'">Preview</button>
        <button :class="{ active: renderMode === 'source' }" type="button" @click="renderMode = 'source'">Source</button>
      </div>

      <dl class="specs">
        <div>
          <dt>Trim</dt>
          <dd>{{ selectedPageSize.width }} x {{ selectedPageSize.height }}</dd>
        </div>
        <div>
          <dt>Margin</dt>
          <dd>20mm text / 0 image plate</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ status }}</dd>
        </div>
      </dl>

      <div class="actions">
        <button type="button" @click="renderPagedPreview">Repaginate</button>
        <button type="button" class="primary" @click="printBook">Print</button>
      </div>
    </aside>

    <section class="workbench" aria-label="Book preview">
      <div v-show="renderMode === 'preview'" ref="pagedOutput" class="paged-output"></div>
      <pre v-show="renderMode === 'source'" class="source-view">{{ bookHtml }}</pre>
    </section>
  </main>
</template>
