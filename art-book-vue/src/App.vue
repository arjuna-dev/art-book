<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
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
  renderOppositeCaptionSpread,
  templateOptions as artworkTemplateOptions,
} from "./templates/artworkTemplates";

const SCREEN_PREVIEW_WIDTH = Math.round(((216 * 2) / 25.4) * 96 + 56);
const WORKBENCH_SCROLL_KEY = "art-book-workbench-scroll";
const pageSize = {
  label: "Square",
  width: "216mm",
  height: "216mm",
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
const catalogPieceMap = new Map(
  catalogPieces.map((piece) => [piece.key, piece]),
);
const layoutHelpers = {
  catalogPieces,
  catalogPieceMap,
  artworkTemplates,
  defaultArtworkTemplate,
};
const layoutState = ref(migrateLayoutState(layoutData, layoutHelpers));

const pageEntries = computed(() => layoutState.value.pages ?? []);
const coverEntry = computed(() => layoutState.value.cover ?? {});
const physicalPageEntries = computed(() => buildPhysicalPageEntries());
const selectedPhysicalPage = computed(
  () => physicalPageEntries.value[selectedPageNumber.value - 1] ?? null,
);
const selectedPage = computed(() =>
  selectedPhysicalPage.value?.kind === "artwork"
    ? (pageEntries.value[selectedPhysicalPage.value.pageIndex] ?? null)
    : null,
);
const selectedArtworkPageIndex = computed(
  () => selectedPhysicalPage.value?.pageIndex ?? -1,
);
const selectedCoverImagePiece = computed(
  () => catalogPieceMap.get(coverEntry.value.imageArtworkKey ?? "") ?? null,
);
const selectedPageTemplate = computed(
  () =>
    artworkTemplates[selectedPage.value?.template] ??
    artworkTemplates[defaultArtworkTemplate],
);
const selectedImageSlotCount = computed(
  () => selectedPageTemplate.value.supports.imageSlots ?? 1,
);
const selectedSupportsOppositeCaption = computed(
  () => selectedPage.value?.template === "full-bleed",
);
const selectedSupportsAdjacentTombstone = computed(
  () => selectedPageTemplate.value.supports.adjacentTombstone === true,
);
const selectedSupportsSupportingTextPosition = computed(() =>
  [
    "top-bleed-text",
    "top-inset-text",
    "top-text-bottom-bleed",
    "top-text-bottom-inset",
  ].includes(selectedPage.value?.template),
);
const selectedSupportsImageRatioMode = computed(() =>
  ["two-image-diagonal-left", "two-image-diagonal-right"].includes(
    selectedPage.value?.template,
  ),
);
const pageCountLabel = computed(
  () => `${renderedPageCount.value || estimatePageCount()} pages`,
);
const selectedPageLabel = computed(() =>
  selectedPhysicalPage.value
    ? `${selectedPhysicalPage.value.label} of ${physicalPageEntries.value.length}`
    : "No page selected",
);
const selectedCaptionPiece = computed(
  () =>
    catalogPieceMap.get(selectedPage.value?.contentArtworkKey ?? "") ?? null,
);

const bookHtml = computed(() => {
  const entries = pageEntries.value
    .map((page, index) => renderConfiguredPage(page, index))
    .join('<div class="forced-page-break"></div>');

  return `
    ${renderCoverPage()}
    ${entries}
  `;
});

function buildPhysicalPageEntries() {
  const entries = [
    {
      kind: "cover",
      label: "Page 1",
      title: "Cover",
      editable: true,
    },
  ];

  pageEntries.value.forEach((page, pageIndex) => {
    const template =
      artworkTemplates[page.template] ??
      artworkTemplates[defaultArtworkTemplate];
    const physicalPages = physicalPagesForPage(page);

    for (let partIndex = 0; partIndex < physicalPages; partIndex += 1) {
      entries.push({
        kind: "artwork",
        label: `Page ${entries.length + 1}`,
        title:
          physicalPages > 1 && page.oppositeCaptionPage
            ? `${page.oppositeCaptionPosition === "after" ? ["Image", "Caption"][partIndex] : ["Caption", "Image"][partIndex]} for ${template.label}`
            : physicalPages > 1
              ? `${template.label} ${partIndex + 1}/${physicalPages}`
              : template.label,
        editable: true,
        pageIndex,
        partIndex,
      });
    }
  });

  return entries;
}

function physicalPagesForPage(page) {
  const template =
    artworkTemplates[page.template] ?? artworkTemplates[defaultArtworkTemplate];
  if (page.oppositeCaptionPage && page.template === "full-bleed") return 2;
  return template.supports.physicalPages ?? 1;
}

function renderCoverPage() {
  const image =
    catalogPieceMap.get(coverEntry.value.imageArtworkKey)?.image ??
    emptyImage();
  const themeClasses = [
    colorClass(coverEntry.value.backgroundColor, "bg"),
    colorClass(coverEntry.value.textColor, "text"),
  ].join(" ");
  const style = image.src
    ? ` style="--cover-image: url('${cssUrl(image.src)}')"`
    : "";

  return `
    <section class="book-section cover-template ${themeClasses}"${style}>
      <p class="kicker">${escapeHtml(coverEntry.value.kicker)}</p>
      <h1>${escapeHtml(coverEntry.value.title)}</h1>
      <p class="cover-note">${escapeHtml(coverEntry.value.note)}</p>
    </section>
    <div class="forced-page-break"></div>
  `;
}

function createPageEntry(index) {
  return createLayoutPageEntry(
    index,
    layoutState.value.defaults ?? {},
    layoutHelpers,
  );
}

function estimatePageCount() {
  const designedPages = pageEntries.value.reduce(
    (count, page) => count + physicalPagesForPage(page),
    0,
  );

  return designedPages + 1;
}

function renderConfiguredPage(page, pageIndex) {
  const primaryPiece =
    catalogPieceMap.get(page.contentArtworkKey) ??
    catalogPieceMap.get(page.imageArtworkKeys[0]) ??
    catalogPieces[0];
  if (!primaryPiece) return "";

  const imageA =
    catalogPieceMap.get(page.imageArtworkKeys[0])?.image ??
    emptyImage(page.imageArtworkKeys[0]);
  const imageB =
    catalogPieceMap.get(page.imageArtworkKeys[1])?.image ??
    catalogPieceMap.get(page.imageArtworkKeys[0])?.image ??
    emptyImage(page.imageArtworkKeys[1]);
  const template =
    artworkTemplates[page.template] ?? artworkTemplates[defaultArtworkTemplate];
  const supportsAdjacentTombstone =
    template.supports.adjacentTombstone === true;
  const themeClasses = [
    colorClass(page.backgroundColor, "bg"),
    colorClass(page.textColor, "text"),
  ].join(" ");

  const renderInput = {
    piece: primaryPiece,
    artist: primaryPiece.artist,
    pieceIndex: pageIndex,
    images: [imageA, imageB],
    imagePieces: [
      catalogPieceMap.get(page.imageArtworkKeys[0]) ?? primaryPiece,
      catalogPieceMap.get(page.imageArtworkKeys[1]) ??
        catalogPieceMap.get(page.imageArtworkKeys[0]) ??
        primaryPiece,
    ],
    artistPortrait: artistPortraitForArtist(primaryPiece.artist),
    themeClasses,
    helpers: { escapeHtml, splitText },
    options: {
      showTombstone: page.showTombstone,
      showImageTombstone: page.showImageTombstone,
      showDescription: page.showDescription,
      showArtistDescription: page.showArtistDescription,
      imageRatioModes: page.imageRatioModes,
      adjacentTombstone: supportsAdjacentTombstone
        ? adjacentTombstoneForPage(page, pageIndex)
        : null,
    },
  };

  if (page.oppositeCaptionPage && page.template === "full-bleed") {
    return renderOppositeCaptionSpread({
      ...renderInput,
      position: page.oppositeCaptionPosition,
    });
  }

  return template.render(renderInput);
}

function adjacentTombstoneForPage(page, pageIndex) {
  if (!page.adjacentTombstonePage) return null;

  const adjacentIndex =
    page.adjacentTombstonePosition === "next" ? pageIndex + 1 : pageIndex - 1;
  const adjacentPage = pageEntries.value[adjacentIndex];
  if (!adjacentPage) return null;

  const adjacentPiece =
    catalogPieceMap.get(adjacentPage.contentArtworkKey) ??
    catalogPieceMap.get(adjacentPage.imageArtworkKeys?.[0]);
  if (!adjacentPiece) return null;

  return {
    direction: page.adjacentTombstonePosition,
    piece: adjacentPiece,
    artist: adjacentPiece.artist,
  };
}

function imageForPiece(piece, artist) {
  const candidates = Object.entries(imageModules);
  const artistSlug = slugify(artist.artist_name);
  const pieceSlug = slugify(piece.art_piece_name);
  const match = candidates
    .filter(([path]) => path.includes(artistSlug) && path.includes(pieceSlug))
    .sort(([leftPath], [rightPath]) =>
      compareImagePaths(rightPath, leftPath),
    )[0];

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
  const match =
    candidates
      .filter(
        ([path]) =>
          path.includes("generated-images/artists/") &&
          path.includes(`${artistSlug}-portrait`),
      )
      .sort(([leftPath], [rightPath]) =>
        compareImagePaths(rightPath, leftPath),
      )[0] ??
    candidates
      .filter(
        ([path]) => path.includes(artistSlug) && path.includes("portrait"),
      )
      .sort(([leftPath], [rightPath]) =>
        compareImagePaths(rightPath, leftPath),
      )[0];

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

function cssUrl(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'");
}

function imageKey(artist, piece) {
  return `${slugify(artist.artist_name)}--${slugify(piece.art_piece_name)}`;
}

function updatePageField(field, value) {
  const index = selectedArtworkPageIndex.value;
  if (index < 0 || index >= pageEntries.value.length) return;

  const nextPages = [...pageEntries.value];
  const current = nextPages[index];
  const isTemplateChange = field === "template";
  const nextTemplate = isTemplateChange
    ? (artworkTemplates[value] ?? artworkTemplates[defaultArtworkTemplate])
    : null;
  const nextInputBase = { ...current, [field]: value };
  const nextInput =
    isTemplateChange && nextTemplate?.supports.adjacentTombstone !== true
      ? {
          ...nextInputBase,
          adjacentTombstonePage: false,
          adjacentTombstonePosition: "previous",
        }
      : nextInputBase;
  const nextPage = normalizePageEntry(
    nextInput,
    index,
    layoutState.value.defaults ?? {},
    layoutHelpers,
  );

  nextPages[index] = nextPage;
  layoutState.value = { ...layoutState.value, pages: nextPages };
  queueLayoutSave();
}

function updateCoverField(field, value) {
  layoutState.value = {
    ...layoutState.value,
    cover: {
      ...coverEntry.value,
      [field]: value === "" ? null : value,
    },
  };
  queueLayoutSave();
}

function updatePageToggle(field, checked) {
  updatePageField(field, checked);
}

function updatePageImage(slotIndex, value) {
  const index = selectedArtworkPageIndex.value;
  if (index < 0 || index >= pageEntries.value.length) return;

  const nextPages = [...pageEntries.value];
  const current = nextPages[index];
  const imageArtworkKeys = [...current.imageArtworkKeys];
  imageArtworkKeys[slotIndex] =
    value === ""
      ? null
      : value && catalogPieceMap.has(value)
        ? value
        : current.imageArtworkKeys[slotIndex];

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
  selectedPageNumber.value = Math.min(
    selectedPageNumber.value,
    physicalPageEntries.value.length,
  );
  queueLayoutSave();
}

function updateSelectedPageNumber(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return;
  selectedPageNumber.value = Math.max(
    1,
    Math.min(physicalPageEntries.value.length, parsed),
  );
}

function shiftSelectedPage(delta) {
  updateSelectedPageNumber(selectedPageNumber.value + delta);
}

function exportLayoutState() {
  const blob = new Blob(
    [
      `${JSON.stringify(normalizedLayoutState(layoutState.value, layoutHelpers), null, 2)}\n`,
    ],
    {
      type: "application/json",
    },
  );
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
      body: JSON.stringify(
        normalizedLayoutState(layoutState.value, layoutHelpers),
      ),
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
  localStorage.setItem(
    WORKBENCH_SCROLL_KEY,
    JSON.stringify(captureWorkbenchScroll()),
  );
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

  const sheetCount =
    pagedOutput.value.querySelectorAll(".pagedjs_sheet").length;
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
  const nextScale = Math.min(
    1,
    Math.max(0.48, availableWidth / SCREEN_PREVIEW_WIDTH),
  );
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
  workbench.value?.addEventListener("scroll", persistWorkbenchScroll, {
    passive: true,
  });
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
      :aria-label="
        isPanelCollapsed ? 'Open settings panel' : 'Collapse settings panel'
      "
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
          <p class="brand-note">Build the book one designed page at a time.</p>
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
          <span>Artwork Records</span>
          <input
            type="number"
            min="1"
            max="200"
            :value="pageEntries.length"
            @change="updatePageCount($event.target.value)"
          />
          <small class="control-note">
            Physical pages include the cover, intro, and any multi-page artwork
            templates.
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
                v-for="(page, index) in physicalPageEntries"
                :key="`${page.kind}-${page.pageIndex ?? 'front'}-${page.partIndex ?? 0}`"
                :value="index + 1"
              >
                {{ page.label }}
              </option>
            </select>
            <Button
              variant="secondary"
              size="icon"
              type="button"
              :disabled="selectedPageNumber >= physicalPageEntries.length"
              @click="shiftSelectedPage(1)"
            >
              <ChevronRight :size="16" />
            </Button>
          </div>
          <small class="control-note">{{ selectedPageLabel }}</small>
        </div>

        <template v-if="selectedPhysicalPage?.kind === 'cover'">
          <label class="control-block">
            <span>Cover Image</span>
            <select
              :value="coverEntry.imageArtworkKey ?? ''"
              @change="updateCoverField('imageArtworkKey', $event.target.value)"
            >
              <option value="">No Image</option>
              <option
                v-for="piece in catalogPieces"
                :key="piece.key"
                :value="piece.key"
              >
                {{ piece.globalIndex + 1 }} — {{ piece.artist.artist_name }} —
                {{ piece.art_piece_name }}
              </option>
            </select>
            <small class="control-note">
              {{ selectedCoverImagePiece?.artist?.artist_name }} /
              {{ selectedCoverImagePiece?.art_piece_name }}
            </small>
          </label>

          <div class="control-block">
            <span>Cover Text Color</span>
            <div class="swatches" aria-label="Cover text color">
              <button
                v-for="color in colorOptions"
                :key="color.id"
                type="button"
                :class="{ active: coverEntry.textColor === color.id }"
                :style="{ '--swatch': color.value }"
                :aria-label="color.label"
                @click="updateCoverField('textColor', color.id)"
              ></button>
            </div>
          </div>

          <div class="control-block">
            <span>Cover Background</span>
            <div class="swatches" aria-label="Cover background color">
              <button
                v-for="color in colorOptions"
                :key="color.id"
                type="button"
                :class="{ active: coverEntry.backgroundColor === color.id }"
                :style="{ '--swatch': color.value }"
                :aria-label="color.label"
                @click="updateCoverField('backgroundColor', color.id)"
              ></button>
            </div>
          </div>
        </template>

        <div
          v-else-if="selectedPhysicalPage?.kind === 'intro'"
          class="control-block"
        >
          <span>Intro</span>
          <small class="control-note">
            This front-matter page is currently fixed in the book template.
          </small>
        </div>

        <template v-else>
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
              {{ selectedPageTemplate.supports.physicalPages }} physical
              page<span v-if="selectedPageTemplate.supports.physicalPages > 1"
                >s</span
              >
            </small>
          </label>

          <label class="control-block">
            <span>Caption Source</span>
            <select
              :value="selectedPage?.contentArtworkKey"
              @change="
                updatePageField('contentArtworkKey', $event.target.value)
              "
            >
              <option
                v-for="piece in catalogPieces"
                :key="piece.key"
                :value="piece.key"
              >
                {{ piece.globalIndex + 1 }} — {{ piece.artist.artist_name }} —
                {{ piece.art_piece_name }}
              </option>
            </select>
            <small class="control-note">
              {{ selectedCaptionPiece?.artist?.artist_name }} /
              {{ selectedCaptionPiece?.art_piece_name }}
            </small>
          </label>

          <label v-if="selectedImageSlotCount > 0" class="control-block">
            <span>Image A</span>
            <select
              :value="selectedPage?.imageArtworkKeys?.[0] ?? ''"
              @change="updatePageImage(0, $event.target.value)"
            >
              <option value="">No Image</option>
              <option
                v-for="piece in catalogPieces"
                :key="piece.key"
                :value="piece.key"
              >
                {{ piece.globalIndex + 1 }} — {{ piece.artist.artist_name }} —
                {{ piece.art_piece_name }}
              </option>
            </select>
          </label>

          <label v-if="selectedImageSlotCount > 1" class="control-block">
            <span>Image B</span>
            <select
              :value="selectedPage?.imageArtworkKeys?.[1] ?? ''"
              @change="updatePageImage(1, $event.target.value)"
            >
              <option value="">No Image</option>
              <option
                v-for="piece in catalogPieces"
                :key="piece.key"
                :value="piece.key"
              >
                {{ piece.globalIndex + 1 }} — {{ piece.artist.artist_name }} —
                {{ piece.art_piece_name }}
              </option>
            </select>
          </label>

          <label v-if="selectedSupportsImageRatioMode" class="control-block">
            <span>Image A Ratio</span>
            <select
              :value="selectedPage?.imageRatioModes?.[0]"
              @change="
                updatePageField('imageRatioModes', [
                  $event.target.value,
                  selectedPage?.imageRatioModes?.[1] ?? 'landscape',
                ])
              "
            >
              <option value="landscape">Landscape crop</option>
              <option value="portrait">Portrait crop</option>
            </select>
          </label>

          <label v-if="selectedSupportsImageRatioMode" class="control-block">
            <span>Image B Ratio</span>
            <select
              :value="selectedPage?.imageRatioModes?.[1]"
              @change="
                updatePageField('imageRatioModes', [
                  selectedPage?.imageRatioModes?.[0] ?? 'landscape',
                  $event.target.value,
                ])
              "
            >
              <option value="landscape">Landscape crop</option>
              <option value="portrait">Portrait crop</option>
            </select>
          </label>

          <div class="control-block">
            <span>Text Blocks</span>
            <label class="toggle-row">
              <input
                type="checkbox"
                :checked="selectedPage?.showDescription"
                @change="
                  updatePageToggle('showDescription', $event.target.checked)
                "
              />
              <span>Artwork description</span>
            </label>
            <label class="toggle-row">
              <input
                type="checkbox"
                :checked="selectedPage?.showTombstone"
                @change="
                  updatePageToggle('showTombstone', $event.target.checked)
                "
              />
              <span>{{
                selectedPageTemplate.supports.usesArtistPortrait
                  ? 'Adjacent tombstone'
                  : 'Tombstone metadata'
              }}</span>
            </label>
            <label class="toggle-row">
              <input
                type="checkbox"
                :checked="selectedPage?.showArtistDescription"
                @change="
                  updatePageToggle(
                    'showArtistDescription',
                    $event.target.checked,
                  )
                "
              />
              <span>Artist description</span>
            </label>
            <label
              v-if="selectedPageTemplate.supports.usesArtistPortrait"
              class="toggle-row"
            >
              <input
                type="checkbox"
                :checked="selectedPage?.showImageTombstone"
                @change="
                  updatePageToggle(
                    'showImageTombstone',
                    $event.target.checked,
                  )
                "
              />
              <span>Image artwork tombstone</span>
            </label>
            <label
              v-if="selectedSupportsSupportingTextPosition"
              class="control-subfield"
            >
              <span>Supporting text</span>
              <select
                :value="selectedPage?.supportingTextPosition"
                @change="
                  updatePageField(
                    'supportingTextPosition',
                    $event.target.value,
                  )
                "
              >
                <option value="above">Above tombstones</option>
                <option value="below">Below tombstones</option>
              </select>
            </label>
          </div>

          <div v-if="selectedSupportsOppositeCaption" class="control-block">
            <span>Opposite Caption Page</span>
            <label class="toggle-row">
              <input
                type="checkbox"
                :checked="selectedPage?.oppositeCaptionPage"
                @change="
                  updatePageToggle('oppositeCaptionPage', $event.target.checked)
                "
              />
              <span>Use separate caption page</span>
            </label>
            <label
              v-if="selectedPage?.oppositeCaptionPage"
              class="control-subfield"
            >
              <span>Position</span>
              <select
                :value="selectedPage?.oppositeCaptionPosition"
                @change="
                  updatePageField(
                    'oppositeCaptionPosition',
                    $event.target.value,
                  )
                "
              >
                <option value="before">Caption before image</option>
                <option value="after">Caption after image</option>
              </select>
            </label>
          </div>

          <div v-if="selectedSupportsAdjacentTombstone" class="control-block">
            <span>Referenced Tombstone</span>
            <label class="toggle-row">
              <input
                type="checkbox"
                :checked="selectedPage?.adjacentTombstonePage"
                @change="
                  updatePageToggle(
                    'adjacentTombstonePage',
                    $event.target.checked,
                  )
                "
              />
              <span>Add neighboring artwork tombstone</span>
            </label>
            <label
              v-if="selectedPage?.adjacentTombstonePage"
              class="control-subfield"
            >
              <span>Reference</span>
              <select
                :value="selectedPage?.adjacentTombstonePosition"
                @change="
                  updatePageField(
                    'adjacentTombstonePosition',
                    $event.target.value,
                  )
                "
              >
                <option value="previous">Previous page</option>
                <option value="next">Next page</option>
              </select>
            </label>
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
        </template>

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

    <section ref="workbench" class="workbench" aria-label="Book preview">
      <div v-show="renderMode === 'preview'" class="preview-frame">
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
