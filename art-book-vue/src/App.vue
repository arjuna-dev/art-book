<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { Previewer } from "pagedjs";
import { FileDown, Menu, PanelLeftClose, RefreshCw } from "lucide-vue-next";
import artData from "../../list.json";
import bookCssUrl from "./styles/book.css?url";
import Button from "./components/ui/button/Button.vue";

const renderMode = ref("preview");
const status = ref("Preparing pages");
const pagedOutput = ref(null);
const isPanelCollapsed = ref(false);
const selectedTemplate = ref("all");
const selectedTheme = ref("paper");
const renderedPageCount = ref(0);
const pageSize = {
  label: "Small Landscape",
  width: "229mm",
  height: "178mm",
};

const imageModules = import.meta.glob(
  "../../generated-images/**/*.{png,jpg,jpeg,webp}",
  { eager: true, import: "default", query: "?url" },
);

const themeOptions = [
  { id: "paper", label: "Paper", swatch: "#f6efe1" },
  { id: "white", label: "White", swatch: "#ffffff" },
  { id: "black", label: "Black", swatch: "#11110f" },
  { id: "red", label: "Red", swatch: "#a92828" },
  { id: "blue", label: "Blue", swatch: "#1f5f8f" },
  { id: "orange", label: "Orange", swatch: "#ef8f32" },
];

const templateOptions = [
  { id: "all", label: "Mixed book" },
  { id: "spread-image", label: "Two-page image" },
  { id: "artist-profile", label: "Artist profile" },
  { id: "panorama-text", label: "Panorama text" },
  { id: "full-bleed", label: "Full bleed" },
  { id: "padded-plate", label: "Padded plate" },
];

const artPieces = computed(() =>
  artData.flatMap((artist, artistIndex) =>
    artist.art_pieces.map((piece, pieceIndex) => ({
      ...piece,
      artist,
      artistIndex,
      pieceIndex,
      globalIndex: artData
        .slice(0, artistIndex)
        .reduce((total, item) => total + item.art_pieces.length, pieceIndex),
      image: imageForPiece(piece, artist, pieceIndex),
    })),
  ),
);
const pageCountLabel = computed(
  () => `${renderedPageCount.value || estimatePageCount()} pages`,
);

const bookHtml = computed(() => {
  const entries = artData
    .map((artist, index) => renderArtistSection(artist, index))
    .join("");

  return `
    <section class="book-section cover-template theme-black">
      <p class="kicker">Working catalogue</p>
      <h1>Speculative Works</h1>
      <p class="cover-note">A print-first art book populated from list.json, assembled from artist notes, generated studies, and installation concepts.</p>
    </section>
    <section class="book-section intro-template ${themeClass.value}">
      <h2>Format Study</h2>
      <p>This proof contains reusable page templates for artist profiles, full-bleed plates, padded art information plates, two-page image spreads, and panorama layouts with text below each half.</p>
      <p>Each page carries artwork metadata wherever the image treatment allows it, so the visual catalogue remains useful even while the design language is still changing.</p>
    </section>
    ${entries}
  `;
});

const themeClass = computed(() => `theme-${selectedTheme.value}`);

function estimatePageCount() {
  const pieces = artPieces.value.length;
  if (selectedTemplate.value === "all") return artData.length + pieces * 2 + 2;
  if (selectedTemplate.value === "artist-profile") return artData.length + 2;
  return pieces * 2 + 2;
}

function renderArtistSection(artist, artistIndex) {
  if (selectedTemplate.value === "artist-profile") {
    return renderArtistProfile(artist, artistIndex);
  }

  const pieces = artist.art_pieces
    .map((piece, pieceIndex) =>
      renderPieceTemplates(piece, artist, pieceIndex, artistIndex),
    )
    .join("");

  return selectedTemplate.value === "all"
    ? `${renderArtistProfile(artist, artistIndex)}${pieces}`
    : pieces;
}

function renderArtistProfile(artist, artistIndex) {
  const featurePiece = artist.art_pieces[0];
  const image = imageForPiece(featurePiece, artist, 0);
  const summaries = artist.art_pieces
    .slice(0, 4)
    .map(
      (piece) => `
        <li>
          <strong>${escapeHtml(piece.art_piece_name)}</strong>
          <span>${escapeHtml(piece.short_description)}</span>
        </li>
      `,
    )
    .join("");

  return `
    <section class="book-section artist-profile-template ${themeClass.value}">
      <div class="artist-profile-copy">
        <p class="kicker">${String(artistIndex + 1).padStart(2, "0")} / ${escapeHtml(artist.series_name)}</p>
        <h2>${escapeHtml(artist.artist_name)}</h2>
        <p>${escapeHtml(artist.artist_introduction)}</p>
        <ul>${summaries}</ul>
      </div>
      <figure class="artist-profile-art">
        <img src="${image}" alt="" />
        <figcaption>${escapeHtml(featurePiece.art_piece_name)} · ${escapeHtml(featurePiece.year)}</figcaption>
      </figure>
    </section>
  `;
}

function renderPieceTemplates(piece, artist, pieceIndex, artistIndex) {
  const globalIndex = artData
    .slice(0, artistIndex)
    .reduce((total, item) => total + item.art_pieces.length, pieceIndex);
  const template =
    selectedTemplate.value === "all"
      ? ["spread-image", "padded-plate", "panorama-text", "full-bleed"][
          globalIndex % 4
        ]
      : selectedTemplate.value;

  if (template === "spread-image") {
    return renderTwoPageImage(piece, artist, pieceIndex);
  }
  if (template === "panorama-text") {
    return renderPanoramaText(piece, artist, pieceIndex);
  }
  if (template === "full-bleed") {
    return renderFullBleed(piece, artist, pieceIndex);
  }
  return renderPaddedPlate(piece, artist, pieceIndex);
}

function renderArtworkInfo(piece, artist, pieceIndex, extraClass = "") {
  const number = String(pieceIndex + 1).padStart(2, "0");

  return `
    <div class="artwork-info ${extraClass}">
      <div class="artwork-meta">
        <p class="artwork-number">${number} / ${escapeHtml(artist.artist_name)}</p>
        <h2>${escapeHtml(piece.art_piece_name)}</h2>
      </div>
      <p>${escapeHtml(piece.long_description || piece.short_description)}</p>
      <dl>
        <div><dt>Year</dt><dd>${escapeHtml(piece.year)}</dd></div>
        <div><dt>Technique</dt><dd>${escapeHtml(piece.technique_used)}</dd></div>
        <div><dt>Context</dt><dd>${escapeHtml(piece.display_context)}</dd></div>
      </dl>
    </div>
  `;
}

function renderTwoPageImage(piece, artist, pieceIndex) {
  const image = imageForPiece(piece, artist, pieceIndex);

  return `
    <section class="book-section spread-image-template spread-left">
      <img src="${image}" alt="" />
    </section>
    <section class="book-section spread-image-template spread-right">
      <img src="${image}" alt="" />
      ${renderArtworkInfo(piece, artist, pieceIndex, "overlay-info compact")}
    </section>
  `;
}

function renderPanoramaText(piece, artist, pieceIndex) {
  const image = imageForPiece(piece, artist, pieceIndex);
  const split = splitText(piece.long_description || piece.short_description);

  return `
    <section class="book-section panorama-template panorama-left ${themeClass.value}">
      <img src="${image}" alt="" />
      ${renderArtworkInfo({ ...piece, long_description: split[0] }, artist, pieceIndex)}
    </section>
    <section class="book-section panorama-template panorama-right ${themeClass.value}">
      <img src="${image}" alt="" />
      ${renderArtworkInfo({ ...piece, long_description: split[1] }, artist, pieceIndex)}
    </section>
  `;
}

function renderFullBleed(piece, artist, pieceIndex) {
  const image = imageForPiece(piece, artist, pieceIndex);

  return `
    <section class="book-section full-bleed-template">
      <img src="${image}" alt="" />
      ${renderArtworkInfo(piece, artist, pieceIndex, "overlay-info")}
    </section>
    <section class="book-section artwork-template ${themeClass.value}">
      ${renderArtworkInfo(piece, artist, pieceIndex)}
    </section>
  `;
}

function renderPaddedPlate(piece, artist, pieceIndex) {
  const image = imageForPiece(piece, artist, pieceIndex);

  return `
    <section class="book-section padded-plate-template ${themeClass.value}">
      <figure>
        <img src="${image}" alt="" />
      </figure>
      ${renderArtworkInfo(piece, artist, pieceIndex, "plate-margin-info")}
    </section>
    <section class="book-section artwork-template ${themeClass.value}">
      ${renderArtworkInfo(piece, artist, pieceIndex)}
    </section>
  `;
}

function imageForPiece(piece, artist, pieceIndex) {
  const candidates = Object.entries(imageModules);
  const artistSlug = slugify(artist.artist_name);
  const pieceSlug = slugify(piece.art_piece_name);
  const match = candidates.find(
    ([path]) => path.includes(artistSlug) && path.includes(pieceSlug),
  );
  const fallback = candidates[(artist.art_pieces.length + pieceIndex) % candidates.length];

  return match?.[1] ?? fallback?.[1] ?? "";
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitText(value) {
  const sentences = value.match(/[^.!?]+[.!?]+/g) ?? [value];
  const midpoint = Math.ceil(sentences.length / 2);
  return [
    sentences.slice(0, midpoint).join(" ").trim(),
    sentences.slice(midpoint).join(" ").trim() || value,
  ];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderPagedPreview() {
  if (!pagedOutput.value) return;

  window.__ART_BOOK_PAGED_READY__ = false;
  status.value = "Paginating";
  renderedPageCount.value = 0;
  pagedOutput.value.innerHTML = "";

  await nextTick();

  const previewer = new Previewer();
  await previewer.preview(
    bookHtml.value,
    [bookCssUrl],
    pagedOutput.value,
  );

  const sheetCount = pagedOutput.value.querySelectorAll(".pagedjs_sheet").length;
  renderedPageCount.value =
    sheetCount || pagedOutput.value.querySelectorAll(".pagedjs_page").length;
  status.value = "Paged";
  window.__ART_BOOK_PAGED_READY__ = true;
}

function printBook() {
  window.print();
}

function updateTemplate(value) {
  selectedTemplate.value = value;
  renderPagedPreview();
}

function updateTheme(value) {
  selectedTheme.value = value;
  renderPagedPreview();
}

onMounted(renderPagedPreview);
</script>

<template>
  <main class="studio" :class="{ 'panel-collapsed': isPanelCollapsed }">
    <Button
      class="panel-toggle"
      variant="secondary"
      size="icon"
      type="button"
      :aria-label="isPanelCollapsed ? 'Open settings panel' : 'Collapse settings panel'"
      @click="isPanelCollapsed = !isPanelCollapsed"
    >
      <Menu v-if="isPanelCollapsed" :size="17" />
      <PanelLeftClose v-else :size="17" />
    </Button>

    <aside class="studio-panel" aria-label="Book controls">
      <div class="panel-edge" aria-hidden="true">
        <span class="panel-edge-label">Speculative Works</span>
      </div>

      <div class="panel-body">
        <div class="brand-lockup">
          <p class="eyebrow">Paged.js Studio</p>
          <h1>Art<br />Book</h1>
        </div>

        <div class="segmented" aria-label="View mode">
          <Button
            :class="{ active: renderMode === 'preview' }"
            variant="ghost"
            type="button"
            @click="renderMode = 'preview'"
          >
            Preview
          </Button>
          <Button
            :class="{ active: renderMode === 'source' }"
            variant="ghost"
            type="button"
            @click="renderMode = 'source'"
          >
            Source
          </Button>
        </div>

        <dl class="specs">
          <div>
            <dt>Trim</dt>
            <dd>{{ pageSize.width }} × {{ pageSize.height }}</dd>
          </div>
          <div>
            <dt>Extent</dt>
            <dd>{{ pageCountLabel }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{{ status }}</dd>
          </div>
        </dl>

        <label class="control-block">
          <span>Template</span>
          <select
            :value="selectedTemplate"
            @change="updateTemplate($event.target.value)"
          >
            <option
              v-for="template in templateOptions"
              :key="template.id"
              :value="template.id"
            >
              {{ template.label }}
            </option>
          </select>
        </label>

        <div class="control-block">
          <span>Colorway</span>
          <div class="swatches" aria-label="Colorway">
            <button
              v-for="theme in themeOptions"
              :key="theme.id"
              type="button"
              :class="{ active: selectedTheme === theme.id }"
              :style="{ '--swatch': theme.swatch }"
              :aria-label="theme.label"
              @click="updateTheme(theme.id)"
            ></button>
          </div>
        </div>

        <div class="actions">
          <Button variant="secondary" type="button" @click="renderPagedPreview">
            <RefreshCw :size="14" />
            Repaginate
          </Button>
          <Button type="button" @click="printBook">
            <FileDown :size="14" />
            Print
          </Button>
        </div>
      </div>
    </aside>

    <section class="workbench" aria-label="Book preview">
      <div
        v-show="renderMode === 'preview'"
        ref="pagedOutput"
        class="paged-output"
      ></div>
      <pre v-show="renderMode === 'source'" class="source-view">{{
        bookHtml
      }}</pre>
    </section>
  </main>
</template>
