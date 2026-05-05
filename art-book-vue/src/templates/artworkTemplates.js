export const colorOptions = [
  { id: "paper", label: "Paper", value: "#f6efe1" },
  { id: "white", label: "White", value: "#fff7f1" },
  { id: "black", label: "Black", value: "#11110f" },
  { id: "pink", label: "Pink", value: "#ff3cac" },
  { id: "lime", label: "Lime", value: "#b8ff35" },
  { id: "cyan", label: "Cyan", value: "#1be7ff" },
  { id: "yellow", label: "Yellow", value: "#ffd84d" },
  { id: "orange", label: "Orange", value: "#ff7a00" },
  { id: "violet", label: "Violet", value: "#7657ff" },
];

export const templateOptions = [
  { id: "artist-portrait", label: "Artist portrait" },
  { id: "square-caption", label: "Square image with caption" },
  { id: "full-bleed", label: "Full bleed" },
  { id: "full-bleed-caption", label: "Caption then full bleed" },
  { id: "top-bleed-text", label: "Bleed image top, text bottom" },
  { id: "top-inset-text", label: "Inset image top, text bottom" },
  { id: "left-image-text", label: "Inset image left, text right" },
  { id: "left-bleed-image-text", label: "Bleed image left, text right" },
  { id: "right-image-text", label: "Text left, inset image right" },
  { id: "right-bleed-image-text", label: "Text left, bleed image right" },
  { id: "top-text-bottom-bleed", label: "Text top, bleed image bottom" },
  { id: "top-text-bottom-inset", label: "Text top, inset image bottom" },
];

export const colorClass = (colorId, prefix) => `${prefix}-${colorId || "paper"}`;

export const defaultArtworkTemplate = "square-caption";

export const artworkTemplates = {
  "artist-portrait": {
    label: "Artist portrait",
    supports: { captions: true, imageSlots: 0, physicalPages: 1, usesArtistPortrait: true },
    render: renderArtistPortrait,
  },
  "square-caption": {
    label: "Square image with caption",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderSquareCaption,
  },
  "full-bleed": {
    label: "Full bleed",
    supports: { captions: false, imageSlots: 1, physicalPages: 1 },
    render: renderFullBleed,
  },
  "full-bleed-caption": {
    label: "Caption then full bleed",
    supports: { captions: true, imageSlots: 1, physicalPages: 2 },
    render: renderFullBleedCaption,
  },
  "top-bleed-text": {
    label: "Bleed image top, text bottom",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderTopBleedText,
  },
  "top-inset-text": {
    label: "Inset image top, text bottom",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderTopInsetText,
  },
  "left-image-text": {
    label: "Inset image left, text right",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderLeftImageText,
  },
  "left-bleed-image-text": {
    label: "Bleed image left, text right",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderLeftBleedImageText,
  },
  "right-image-text": {
    label: "Text left, inset image right",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderRightImageText,
  },
  "right-bleed-image-text": {
    label: "Text left, bleed image right",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderRightBleedImageText,
  },
  "top-text-bottom-bleed": {
    label: "Text top, bleed image bottom",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderTopTextBottomBleed,
  },
  "top-text-bottom-inset": {
    label: "Text top, inset image bottom",
    supports: { captions: true, imageSlots: 1, physicalPages: 1 },
    render: renderTopTextBottomInset,
  },
};

function renderCaptionBlock(piece, artist, pieceIndex, helpers, options, extraClass = "") {
  const { escapeHtml } = helpers;
  const number = String(pieceIndex + 1).padStart(2, "0");
  const blocks = [];

  if (options?.showDescription !== false) {
    blocks.push(`<p>${escapeHtml(piece.long_description || piece.short_description)}</p>`);
  }

  if (options?.showArtistDescription === true) {
    blocks.push(`<p class="artist-description">${escapeHtml(artist.artist_introduction)}</p>`);
  }

  const tombstone = options?.showTombstone !== false
    ? `
      <dl>
        <div><dt>Year</dt><dd>${escapeHtml(piece.year)}</dd></div>
        <div><dt>Technique</dt><dd>${escapeHtml(piece.technique_used)}</dd></div>
        <div><dt>Context</dt><dd>${escapeHtml(piece.display_context)}</dd></div>
      </dl>
    `
    : "";

  return `
    <div class="caption-block ${extraClass}">
      <p class="artwork-number">${number} / ${escapeHtml(artist.artist_name)}</p>
      <h2>${escapeHtml(piece.art_piece_name)}</h2>
      ${blocks.join("")}
      ${tombstone}
    </div>
  `;
}

function renderArtworkImage(image, extraClass = "") {
  const classAttr = extraClass ? ` class="${extraClass}"` : "";
  if (image?.src) return `<img${classAttr} src="${image.src}" alt="" />`;
  return `<div class="missing-artwork-image ${extraClass}"></div>`;
}

function renderImageFrame(image, className = "") {
  return `
    <figure class="${className}">
      ${renderArtworkImage(image)}
    </figure>
  `;
}

function renderArtistPortrait({ piece, artist, pieceIndex, artistPortrait, themeClasses, helpers, options }) {
  return `
    <section class="book-section artist-portrait-page ${themeClasses}">
      <div class="artist-portrait-copy">
        ${renderCaptionBlock(piece, artist, pieceIndex, helpers, {
          ...options,
          showArtistDescription: true,
        })}
      </div>
      ${renderImageFrame(artistPortrait, "artist-portrait-frame")}
    </section>
  `;
}

function renderSquareCaption({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return `
    <section class="book-section square-caption-page ${themeClasses}">
      ${renderImageFrame(images[0], "square-caption-frame")}
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, options, "square-caption-copy")}
    </section>
  `;
}

function renderFullBleed({ images = [], themeClasses }) {
  return `
    <section class="book-section full-bleed-page ${themeClasses}">
      ${renderArtworkImage(images[0], "full-bleed-media")}
    </section>
  `;
}

function renderFullBleedCaption({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return `
    <section class="book-section caption-lead-page ${themeClasses}">
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, options, "caption-lead-copy")}
    </section>
    <section class="book-section full-bleed-page ${themeClasses}">
      ${renderArtworkImage(images[0], "full-bleed-media")}
    </section>
  `;
}

function renderTopBleedText({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return `
    <section class="book-section stacked-template stacked-bleed-top ${themeClasses}">
      ${renderImageFrame(images[0], "stacked-media bleed-top-frame")}
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, options, "stacked-copy")}
    </section>
  `;
}

function renderTopInsetText({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return `
    <section class="book-section stacked-template stacked-inset-top ${themeClasses}">
      ${renderImageFrame(images[0], "stacked-media inset-frame")}
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, options, "stacked-copy")}
    </section>
  `;
}

function renderLeftImageText({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return renderSplitTemplate({
    piece,
    artist,
    pieceIndex,
    image: images[0],
    themeClasses,
    helpers,
    options,
    className: "split-template split-inset image-left",
  });
}

function renderLeftBleedImageText({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return renderSplitTemplate({
    piece,
    artist,
    pieceIndex,
    image: images[0],
    themeClasses,
    helpers,
    options,
    className: "split-template split-bleed image-left",
  });
}

function renderRightImageText({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return renderSplitTemplate({
    piece,
    artist,
    pieceIndex,
    image: images[0],
    themeClasses,
    helpers,
    options,
    className: "split-template split-inset image-right",
  });
}

function renderRightBleedImageText({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return renderSplitTemplate({
    piece,
    artist,
    pieceIndex,
    image: images[0],
    themeClasses,
    helpers,
    options,
    className: "split-template split-bleed image-right",
  });
}

function renderTopTextBottomBleed({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return `
    <section class="book-section stacked-template stacked-bottom-image stacked-bottom-bleed ${themeClasses}">
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, options, "stacked-copy")}
      ${renderImageFrame(images[0], "stacked-media bleed-bottom-frame")}
    </section>
  `;
}

function renderTopTextBottomInset({ piece, artist, pieceIndex, images = [], themeClasses, helpers, options }) {
  return `
    <section class="book-section stacked-template stacked-bottom-image stacked-bottom-inset ${themeClasses}">
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, options, "stacked-copy")}
      ${renderImageFrame(images[0], "stacked-media inset-frame")}
    </section>
  `;
}

function renderSplitTemplate({
  piece,
  artist,
  pieceIndex,
  image,
  themeClasses,
  helpers,
  options,
  className,
}) {
  return `
    <section class="book-section ${className} ${themeClasses}">
      ${renderImageFrame(image, "split-media")}
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, options, "split-copy")}
    </section>
  `;
}
