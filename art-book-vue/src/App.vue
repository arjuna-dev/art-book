<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Previewer } from "pagedjs";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Menu,
  PanelLeftClose,
  RefreshCw,
} from "lucide-vue-next";
import artData from "../../list.json";
import layoutData from "../../art-book-layout.json";
import bookCssUrl from "./styles/book.css?url";
import Button from "./components/ui/button/Button.vue";
import {
  buildCatalogPieces,
  createPageEntry as createLayoutPageEntry,
  migrateLayoutState,
  normalizedLayoutState,
  normalizePageEntry,
} from "./lib/layoutState";
import {
  artworkTemplates,
  colorClass,
  colorOptions,
  defaultArtworkTemplate,
  templateOptions as artworkTemplateOptions,
} from "./templates/artworkTemplates";

const SCREEN_PREVIEW_WIDTH = Math.round(((229 * 2) / 25.4) * 96 + 56);
const WORKBENCH_SCROLL_KEY = "art-book-workbench-scroll";
const pageSize = {
  label: "Small Landscape",
  width: "229mm",
  height: "178mm",
};

const renderMode = ref("preview");
const status = ref("Preparing pages");
const saveStatus = ref("Loaded layout JSON");
const isPanelCollapsed = ref(false);
const pagedOutput = ref(null);
const workbench = ref(null);
const selectedPageNumber = ref(1);
const previewScale = ref(1);
const renderedPageCount = ref(0);

let saveTimer = null;
let renderTimer = null;
let resizeObserver = null;
let latestRenderToken = 0;

const imageModules = import.meta.glob(
  "../../generated-images/**/*.{png,jpg,jpeg,webp}",
  { eager: true, import: "default", query: "?url" },
);

const catalogPieces = buildCatalogPieces(artData, imageForPiece);
const catalogPieceMap = new Map(catalogPieces.map((piece) => [piece.key, piece]));
const layoutHelpers = {
  catalogPieces,
  catalogPieceMap,
  artworkTemplates,
  defaultArtworkTemplate,
};
const layoutState = ref(migrateLayoutState(layoutData, layoutHelpers));

const pageEntries = computed(() => layoutState.value.pages ?? []);
const selectedPage = computed(
  () => pageEntries.value[selectedPageNumber.value - 1] ?? null,
);
const selectedPageTemplate = computed(
  () =>
    artworkTemplates[selectedPage.value?.template] ??
    artworkTemplates[defaultArtworkTemplate],
);
const selectedImageSlotCount = computed(() =>
  selectedPageTemplate.value.supports.imageSlots ?? 1,
);
const pageCountLabel = computed(
  () => `${renderedPageCount.value || estimatePageCount()} pages`,
);
const selectedPageLabel = computed(() =>
  selectedPage.value
    ? `Page ${selectedPageNumber.value} of ${pageEntries.value.length}`
    : "No page selected",
);
const selectedCaptionPiece = computed(() =>
  catalogPieceMap.get(selectedPage.value?.contentArtworkKey ?? "") ?? null,
);

const bookHtml = computed(() => {
  const entries = pageEntries.value
    .map((page, index) => renderConfiguredPage(page, index))
    .join("");

  return `
    <section class="book-section cover-template theme-black">
      <p class="kicker">Studio edition</p>
      <h1>Speculative Works</h1>
      <p class="cover-note">A page-based art book prototype for assigning templates, images, captions, and artist notes directly from the studio.</p>
    </section>
    <section class="book-section intro-template theme-yellow">
      <h2>Template Study</h2>
      <p>Each record in the studio now represents a designed template page. Some templates generate one physical page, while caption lead-ins generate two by design.</p>
      <p>Use the panel to assign artwork, pick a page template, and decide whether the page carries tombstone details, description text, or artist notes.</p>
    </section>
    ${entries}
  `;
});

function createPageEntry(index) {
  return createLayoutPageEntry(index, layoutState.value.defaults ?? {}, layoutHelpers);
}

function estimatePageCount() {
  const designedPages = pageEntries.value.reduce((count, page) => {
    const template = artworkTemplates[page.template] ?? artworkTemplates[defaultArtworkTemplate];
    return count + (template.supports.physicalPages ?? 1);
  }, 0);

  return designedPages + 2;
}

function renderConfiguredPage(page, pageIndex) {
  const primaryPiece =
    catalogPieceMap.get(page.contentArtworkKey) ??
    catalogPieceMap.get(page.imageArtworkKeys[0]) ??
    catalogPieces[0];
  if (!primaryPiece) return "";

  const imageA =
    catalogPieceMap.get(page.imageArtworkKeys[0])?.image ?? emptyImage(page.imageArtworkKeys[0]);
  const imageB =
    catalogPieceMap.get(page.imageArtworkKeys[1])?.image ??
    catalogPieceMap.get(page.imageArtworkKeys[0])?.image ??
    emptyImage(page.imageArtworkKeys[1]);
  const template =
    artworkTemplates[page.template] ?? artworkTemplates[defaultArtworkTemplate];
  const themeClasses = [
    colorClass(page.backgroundColor, "bg"),
    colorClass(page.textColor, "text"),
  ].join(" ");

  return template.render({
    piece: primaryPiece,
    artist: primaryPiece.artist,
    pieceIndex: pageIndex,
    images: [imageA, imageB],
    artistPortrait: artistPortraitForArtist(primaryPiece.artist),
    themeClasses,
    helpers: { escapeHtml, splitText },
    options: {
      showTombstone: page.showTombstone,
      showDescription: page.showDescription,
      showArtistDescription: page.showArtistDescription,
    },
  });
}

function imageForPiece(piece, artist) {
  const candidates = Object.entries(imageModules);
  const artistSlug = slugify(artist.artist_name);
  const pieceSlug = slugify(piece.art_piece_name);
  const match = candidates
    .filter(([path]) => path.includes(artistSlug) && path.includes(pieceSlug))
    .sort(([leftPath], [rightPath]) => compareImagePaths(rightPath, leftPath))[0];

  return {
    src: match?.[1] ?? "",
    path: match ? repoRelativeImagePath(match[0]) : null,
    key: imageKey(artist, piece),
    missing: !match,
  };
}

function artistPortraitForArtist(artist) {
  const candidates = Object.entries(imageModules);
  const artistSlug = slugify(artist.artist_name);
  const match = candidates
    .filter(([path]) =>
      path.includes("generated-images/artists/") &&
      path.includes(`${artistSlug}-portrait`),
    )
    .sort(([leftPath], [rightPath]) => compareImagePaths(rightPath, leftPath))[0]
    ?? candidates
      .filter(([path]) => path.includes(artistSlug) && path.includes("portrait"))
      .sort(([leftPath], [rightPath]) => compareImagePaths(rightPath, leftPath))[0];

  return {
    src: match?.[1] ?? "",
    path: match ? repoRelativeImagePath(match[0]) : null,
    key: `${artistSlug}-portrait`,
    missing: !match,
  };
}

function emptyImage(key = "") {
  return {
    src: "",
    path: null,
    key,
    missing: true,
  };
}

function compareImagePaths(leftPath, rightPath) {
  const leftTimestamp = leftPath.match(/\d{8}T\d{6}Z/)?.[0] ?? "";
  const rightTimestamp = rightPath.match(/\d{8}T\d{6}Z/)?.[0] ?? "";

  return (
    leftTimestamp.localeCompare(rightTimestamp) ||
    leftPath.localeCompare(rightPath)
  );
}

function repoRelativeImagePath(pathValue) {
  return pathValue.replace(/^\.\.\/\.\.\//, "");
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

function imageKey(artist, piece) {
  return `${slugify(artist.artist_name)}--${slugify(piece.art_piece_name)}`;
}

function updatePageField(field, value) {
  const index = selectedPageNumber.value - 1;
  if (index < 0 || index >= pageEntries.value.length) return;

  const nextPages = [...pageEntries.value];
  const current = nextPages[index];
  const nextInput =
    field === "template" && value === "artist-portrait"
      ? { ...current, [field]: value, showArtistDescription: true }
      : { ...current, [field]: value };
  const nextPage = normalizePageEntry(nextInput, index, layoutState.value.defaults ?? {}, layoutHelpers);

  nextPages[index] = nextPage;
  layoutState.value = { ...layoutState.value, pages: nextPages };
  queueLayoutSave();
}

function updatePageToggle(field, checked) {
  updatePageField(field, checked);
}

function updatePageImage(slotIndex, value) {
  const index = selectedPageNumber.value - 1;
  if (index < 0 || index >= pageEntries.value.length) return;

  const nextPages = [...pageEntries.value];
  const current = nextPages[index];
  const imageArtworkKeys = [...current.imageArtworkKeys];
  imageArtworkKeys[slotIndex] =
    (value && catalogPieceMap.has(value) ? value : null) ?? current.imageArtworkKeys[slotIndex];

  nextPages[index] = normalizePageEntry(
    { ...current, imageArtworkKeys },
    index,
    layoutState.value.defaults ?? {},
    layoutHelpers,
  );
  layoutState.value = { ...layoutState.value, pages: nextPages };
  queueLayoutSave();
}

function updatePageCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return;

  const nextCount = Math.max(1, Math.min(200, parsed));
  const nextPages = Array.from({ length: nextCount }, (_, index) =>
    normalizePageEntry(
      pageEntries.value[index] ?? createPageEntry(index),
      index,
      layoutState.value.defaults ?? {},
      layoutHelpers,
    ),
  );

  layoutState.value = { ...layoutState.value, pages: nextPages };
  selectedPageNumber.value = Math.min(selectedPageNumber.value, nextCount);
  queueLayoutSave();
}

function updateSelectedPageNumber(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return;
  selectedPageNumber.value = Math.max(1, Math.min(pageEntries.value.length, parsed));
}

function shiftSelectedPage(delta) {
  updateSelectedPageNumber(selectedPageNumber.value + delta);
}

function exportLayoutState() {
  const blob = new Blob([`${JSON.stringify(normalizedLayoutState(layoutState.value, layoutHelpers), null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "art-book-layout.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function saveLayoutState() {
  saveStatus.value = "Saving layout JSON";

  try {
    const response = await fetch("/__art-book-layout__", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(normalizedLayoutState(layoutState.value, layoutHelpers)),
    });

    if (!response.ok) throw new Error(`Save failed with ${response.status}`);
    saveStatus.value = "Saved to art-book-layout.json";
  } catch {
    saveStatus.value = "Auto-save unavailable; use Export JSON";
  }
}

function queueLayoutSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLayoutState, 450);
}

function queuePagedPreviewRender(delay = 90) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderPagedPreview();
  }, delay);
}

function captureWorkbenchScroll() {
  if (!workbench.value) {
    return {
      top: 0,
      left: 0,
      windowTop: window.scrollY,
      windowLeft: window.scrollX,
    };
  }

  return {
    top: workbench.value.scrollTop,
    left: workbench.value.scrollLeft,
    windowTop: window.scrollY,
    windowLeft: window.scrollX,
  };
}

function restoreWorkbenchScroll(scrollState) {
  if (!scrollState) return;

  if (workbench.value) {
    workbench.value.scrollTop = scrollState.top ?? 0;
    workbench.value.scrollLeft = scrollState.left ?? 0;
  }
  window.scrollTo(scrollState.windowLeft ?? 0, scrollState.windowTop ?? 0);
}

function persistWorkbenchScroll() {
  localStorage.setItem(WORKBENCH_SCROLL_KEY, JSON.stringify(captureWorkbenchScroll()));
}

function loadWorkbenchScroll() {
  try {
    return JSON.parse(localStorage.getItem(WORKBENCH_SCROLL_KEY) ?? "null");
  } catch {
    return null;
  }
}

async function renderPagedPreview() {
  if (!pagedOutput.value) return;

  const renderToken = ++latestRenderToken;
  const scrollState = captureWorkbenchScroll();
  window.__ART_BOOK_PAGED_READY__ = false;
  status.value = "Paginating";
  renderedPageCount.value = 0;
  pagedOutput.value.innerHTML = "";

  await nextTick();

  const previewer = new Previewer();
  await previewer.preview(bookHtml.value, [bookCssUrl], pagedOutput.value);

  if (renderToken !== latestRenderToken) return;

  const sheetCount = pagedOutput.value.querySelectorAll(".pagedjs_sheet").length;
  renderedPageCount.value =
    sheetCount || pagedOutput.value.querySelectorAll(".pagedjs_page").length;
  status.value = "Paged";
  window.__ART_BOOK_PAGED_READY__ = true;

  await nextTick();
  updatePreviewScale();
  restoreWorkbenchScroll(scrollState);
}

function updatePreviewScale() {
  if (!workbench.value) return;

  const availableWidth = workbench.value.clientWidth - 56;
  const nextScale = Math.min(1, Math.max(0.48, availableWidth / SCREEN_PREVIEW_WIDTH));
  previewScale.value = Number.isFinite(nextScale) ? nextScale : 1;
}

async function togglePanel() {
  isPanelCollapsed.value = !isPanelCollapsed.value;
  await nextTick();
  updatePreviewScale();
}

function printBook() {
  window.print();
}

watch(
  bookHtml,
  () => {
    queuePagedPreviewRender();
  },
  { flush: "post" },
);

onMounted(() => {
  resizeObserver = new ResizeObserver(() => updatePreviewScale());
  if (workbench.value) resizeObserver.observe(workbench.value);
  restoreWorkbenchScroll(loadWorkbenchScroll());
  workbench.value?.addEventListener("scroll", persistWorkbenchScroll, { passive: true });
  window.addEventListener("scroll", persistWorkbenchScroll, { passive: true });
  queuePagedPreviewRender(0);
  updatePreviewScale();
});

onBeforeUnmount(() => {
  clearTimeout(saveTimer);
  clearTimeout(renderTimer);
  resizeObserver?.disconnect();
  workbench.value?.removeEventListener("scroll", persistWorkbenchScroll);
  window.removeEventListener("scroll", persistWorkbenchScroll);
});
</script>

<template>
  <main class="studio" :class="{ 'panel-collapsed': isPanelCollapsed }">
    <Button
      class="panel-toggle"
      variant="secondary"
      size="icon"
      type="button"
      :aria-label="isPanelCollapsed ? 'Open settings panel' : 'Collapse settings panel'"
      @click="togglePanel"
    >
      <Menu v-if="isPanelCollapsed" :size="18" />
      <PanelLeftClose v-else :size="18" />
    </Button>

    <aside class="studio-panel" aria-label="Book controls">
      <div class="panel-edge" aria-hidden="true">
        <span class="panel-edge-label">Page Composer</span>
      </div>

      <div class="panel-body">
        <div class="brand-lockup">
          <p class="eyebrow">Paged.js studio</p>
          <h1>Page<br />Composer</h1>
          <p class="brand-note">
            Build the book one designed page at a time.
          </p>
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
          <div>
            <dt>Save</dt>
            <dd>{{ saveStatus }}</dd>
          </div>
        </dl>

        <label class="control-block">
          <span>Designed Pages</span>
          <input
            type="number"
            min="1"
            max="200"
            :value="pageEntries.length"
            @change="updatePageCount($event.target.value)"
          />
          <small class="control-note">
            Each configured page produces one or more physical pages depending on the template.
          </small>
        </label>

        <div class="control-block">
          <span>Page Number</span>
          <div class="page-nav">
            <Button
              variant="secondary"
              size="icon"
              type="button"
              :disabled="selectedPageNumber <= 1"
              @click="shiftSelectedPage(-1)"
            >
              <ChevronLeft :size="16" />
            </Button>
            <select
              :value="selectedPageNumber"
              @change="updateSelectedPageNumber($event.target.value)"
            >
            <option
              v-for="(page, index) in pageEntries"
              :key="page.id"
              :value="index + 1"
            >
              Page {{ index + 1 }}
            </option>
          </select>
            <Button
              variant="secondary"
              size="icon"
              type="button"
              :disabled="selectedPageNumber >= pageEntries.length"
              @click="shiftSelectedPage(1)"
            >
              <ChevronRight :size="16" />
            </Button>
          </div>
          <small class="control-note">{{ selectedPageLabel }}</small>
        </div>

        <label class="control-block">
          <span>Template</span>
          <select
            :value="selectedPage?.template"
            @change="updatePageField('template', $event.target.value)"
          >
            <option
              v-for="template in artworkTemplateOptions"
              :key="template.id"
              :value="template.id"
            >
              {{ template.label }}
            </option>
          </select>
          <small class="control-note">
            {{ selectedPageTemplate.supports.physicalPages }} physical page<span v-if="selectedPageTemplate.supports.physicalPages > 1">s</span>
          </small>
        </label>

        <label class="control-block">
          <span>Caption Source</span>
          <select
            :value="selectedPage?.contentArtworkKey"
            @change="updatePageField('contentArtworkKey', $event.target.value)"
          >
            <option
              v-for="piece in catalogPieces"
              :key="piece.key"
              :value="piece.key"
            >
              {{ piece.globalIndex + 1 }} — {{ piece.artist.artist_name }} — {{ piece.art_piece_name }}
            </option>
          </select>
          <small class="control-note">
            {{ selectedCaptionPiece?.artist?.artist_name }} / {{ selectedCaptionPiece?.art_piece_name }}
          </small>
        </label>

        <label
          v-if="selectedImageSlotCount > 0"
          class="control-block"
        >
          <span>Image A</span>
          <select
            :value="selectedPage?.imageArtworkKeys?.[0]"
            @change="updatePageImage(0, $event.target.value)"
          >
            <option
              v-for="piece in catalogPieces"
              :key="piece.key"
              :value="piece.key"
            >
              {{ piece.globalIndex + 1 }} — {{ piece.artist.artist_name }} — {{ piece.art_piece_name }}
            </option>
          </select>
        </label>

        <label
          v-if="selectedImageSlotCount > 1"
          class="control-block"
        >
          <span>Image B</span>
          <select
            :value="selectedPage?.imageArtworkKeys?.[1]"
            @change="updatePageImage(1, $event.target.value)"
          >
            <option
              v-for="piece in catalogPieces"
              :key="piece.key"
              :value="piece.key"
            >
              {{ piece.globalIndex + 1 }} — {{ piece.artist.artist_name }} — {{ piece.art_piece_name }}
            </option>
          </select>
        </label>

        <div class="control-block">
          <span>Text Blocks</span>
          <label class="toggle-row">
            <input
              type="checkbox"
              :checked="selectedPage?.showDescription"
              @change="updatePageToggle('showDescription', $event.target.checked)"
            />
            <span>Artwork description</span>
          </label>
          <label class="toggle-row">
            <input
              type="checkbox"
              :checked="selectedPage?.showTombstone"
              @change="updatePageToggle('showTombstone', $event.target.checked)"
            />
            <span>Tombstone metadata</span>
          </label>
          <label class="toggle-row">
            <input
              type="checkbox"
              :checked="selectedPage?.showArtistDescription"
              @change="updatePageToggle('showArtistDescription', $event.target.checked)"
            />
            <span>Artist description</span>
          </label>
          <small
            v-if="selectedPageTemplate.supports.usesArtistPortrait"
            class="control-note"
          >
            Artist portrait files are resolved from `generated-images/artists/&lt;artist-slug&gt;-portrait.*`.
          </small>
        </div>

        <div class="control-block">
          <span>Text Color</span>
          <div class="swatches" aria-label="Text color">
            <button
              v-for="color in colorOptions"
              :key="color.id"
              type="button"
              :class="{ active: selectedPage?.textColor === color.id }"
              :style="{ '--swatch': color.value }"
              :aria-label="color.label"
              @click="updatePageField('textColor', color.id)"
            ></button>
          </div>
        </div>

        <div class="control-block">
          <span>Background</span>
          <div class="swatches" aria-label="Background color">
            <button
              v-for="color in colorOptions"
              :key="color.id"
              type="button"
              :class="{ active: selectedPage?.backgroundColor === color.id }"
              :style="{ '--swatch': color.value }"
              :aria-label="color.label"
              @click="updatePageField('backgroundColor', color.id)"
            ></button>
          </div>
        </div>

        <div class="actions">
          <Button variant="secondary" type="button" @click="exportLayoutState">
            <Download :size="14" />
            Export JSON
          </Button>
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

    <section
      ref="workbench"
      class="workbench"
      aria-label="Book preview"
    >
      <div
        v-show="renderMode === 'preview'"
        class="preview-frame"
      >
        <div
          ref="pagedOutput"
          class="paged-output"
          :style="{ zoom: previewScale }"
        ></div>
      </div>
      <pre v-show="renderMode === 'source'" class="source-view">{{
        bookHtml
      }}</pre>
    </section>
  </main>
</template>
