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
  { id: "big-square-caption", label: "Big square image with caption" },
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

export const colorClass = (colorId, prefix) =>
  `${prefix}-${colorId || "paper"}`;

export const defaultArtworkTemplate = "square-caption";

export const artworkTemplates = {
  "artist-portrait": {
    label: "Artist portrait",
    supports: {
      captions: true,
      imageSlots: 0,
      physicalPages: 1,
      usesArtistPortrait: true,
      adjacentTombstone: false,
    },
    render: renderArtistPortrait,
  },
  "square-caption": {
    label: "Square image with caption",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderSquareCaption,
  },
  "big-square-caption": {
    label: "Big square image with caption",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderBigSquareCaption,
  },
  "full-bleed": {
    label: "Full bleed",
    supports: {
      captions: false,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderFullBleed,
  },
  "full-bleed-caption": {
    label: "Caption then full bleed",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 2,
      adjacentTombstone: false,
    },
    render: renderFullBleedCaption,
  },
  "top-bleed-text": {
    label: "Bleed image top, text bottom",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderTopBleedText,
  },
  "top-inset-text": {
    label: "Inset image top, text bottom",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderTopInsetText,
  },
  "left-image-text": {
    label: "Inset image left, text right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderLeftImageText,
  },
  "left-bleed-image-text": {
    label: "Bleed image left, text right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderLeftBleedImageText,
  },
  "right-image-text": {
    label: "Text left, inset image right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderRightImageText,
  },
  "right-bleed-image-text": {
    label: "Text left, bleed image right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderRightBleedImageText,
  },
  "top-text-bottom-bleed": {
    label: "Text top, bleed image bottom",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderTopTextBottomBleed,
  },
  "top-text-bottom-inset": {
    label: "Text top, inset image bottom",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: false,
    },
    render: renderTopTextBottomInset,
  },
};

export function renderOppositeCaptionSpread({
  position = "before",
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  const captionPage = `
    <section class="book-section caption-lead-page ${themeClasses}">
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 620, oppositeCaption: true }, "caption-lead-copy")}
    </section>
  `;
  const imagePage = `
    <section class="book-section full-bleed-page ${themeClasses}">
      ${renderArtworkImage(images[0], "full-bleed-media")}
    </section>
  `;

  return position === "after"
    ? `${imagePage}<div class="forced-page-break"></div>${captionPage}`
    : `${captionPage}<div class="forced-page-break"></div>${imagePage}`;
}

function renderCaptionBlock(
  piece,
  artist,
  pieceIndex,
  helpers,
  options,
  extraClass = "",
) {
  const { escapeHtml } = helpers;
  const blocks = [];
  const isArtistPage = options?.captionMode === "artist";

  if (isArtistPage || options?.showArtistDescription === true) {
    blocks.push(
      `<h3 class="artist-name-header">${escapeHtml(artist.artist_name)}</h3>
      <p class="artist-description">${escapeHtml(artist.artist_introduction)}</p>`,
    );
  }

  if (!isArtistPage && options?.showDescription !== false) {
    blocks.push(
      `<p>${escapeHtml(piece.long_description || piece.short_description)}</p>`,
    );
  }

  const oppositePrefix = options?.oppositeCaption ? "(opposite) " : "";
  const tombstone =
    !isArtistPage && options?.showTombstone !== false
      ? `<p class="tombstone-line">${oppositePrefix}<strong class="tombstone-title">${escapeHtml(piece.art_piece_name)}</strong>, ${escapeHtml(piece.year)}, ${escapeHtml(piece.technique_used)}</p>`
      : "";
  const adjacentDirection = options?.adjacentTombstone?.direction ?? null;
  const adjacentClass = adjacentDirection
    ? ` has-adjacent-tombstone adjacent-${adjacentDirection}`
    : "";
  const bodyClass = blocks.length > 0 ? "has-caption-body" : "no-caption-body";

  return `
    <div class="caption-block ${extraClass}${adjacentClass}">
      <div class="caption-block-main ${bodyClass}">
        ${
          blocks.length > 0
            ? `
        <div class="caption-body">
          ${blocks.join("")}
        </div>
        `
            : ""
        }
        ${tombstone}
      </div>
    </div>
  `;
}

function renderAdjacentTombstone(adjacentTombstone, helpers) {
  const { escapeHtml } = helpers;
  const { direction, piece, artist } = adjacentTombstone;

  return `
    <aside class="adjacent-tombstone adjacent-${direction}">
      <p class="tombstone-line">(opposite) <strong class="tombstone-title">${escapeHtml(piece.art_piece_name)}</strong>, ${escapeHtml(piece.year)}, ${escapeHtml(piece.technique_used)}</p>
    </aside>
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

function renderArtistPortrait({
  piece,
  artist,
  pieceIndex,
  artistPortrait,
  themeClasses,
  helpers,
  options,
}) {
  return `
    <section class="book-section artist-portrait-page ${themeClasses}">
      <div class="artist-portrait-copy">
        ${renderCaptionBlock(piece, artist, pieceIndex, helpers, {
          ...options,
          captionMode: "artist",
          artistDescriptionLimit: 760,
          showArtistDescription: true,
        })}
      </div>
      ${renderImageFrame(artistPortrait, "artist-portrait-frame")}
    </section>
  `;
}

function renderSquareCaption({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  const adjacentTombstone = options?.adjacentTombstone
    ? renderAdjacentTombstone(options.adjacentTombstone, helpers)
    : "";
  const adjacentDirection = options?.adjacentTombstone?.direction ?? null;
  const adjacentClass = adjacentDirection
    ? ` has-adjacent-tombstone adjacent-${adjacentDirection}`
    : "";

  return `
    <section class="book-section square-caption-page ${themeClasses}${adjacentClass}">
      ${renderImageFrame(images[0], "square-caption-frame")}
      ${renderCaptionBlock(
        piece,
        artist,
        pieceIndex,
        helpers,
        { ...options, adjacentTombstone: null, descriptionLimit: 300 },
        "square-caption-copy",
      )}
      ${adjacentTombstone}
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

function renderBigSquareCaption({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  return `
    <section class="book-section big-square-caption-page ${themeClasses}">
      ${renderImageFrame(images[0], "big-square-caption-frame")}
      ${renderCaptionBlock(
        piece,
        artist,
        pieceIndex,
        helpers,
        { ...options, adjacentTombstone: null },
        "big-square-caption-copy",
      )}
    </section>
  `;
}

function renderFullBleedCaption({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  return renderOppositeCaptionSpread({
    position: "before",
    piece,
    artist,
    pieceIndex,
    images,
    themeClasses,
    helpers,
    options,
  });
}

function renderTopBleedText({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  return `
    <section class="book-section stacked-template stacked-bleed-top ${themeClasses}">
      ${renderImageFrame(images[0], "stacked-media bleed-top-frame")}
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy")}
    </section>
  `;
}

function renderTopInsetText({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  return `
    <section class="book-section stacked-template stacked-inset-top ${themeClasses}">
      ${renderImageFrame(images[0], "stacked-media inset-frame")}
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy")}
    </section>
  `;
}

function renderLeftImageText({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
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

function renderLeftBleedImageText({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
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

function renderRightImageText({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
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

function renderRightBleedImageText({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
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

function renderTopTextBottomBleed({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  return `
    <section class="book-section stacked-template stacked-bottom-image stacked-bottom-bleed ${themeClasses}">
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy")}
      ${renderImageFrame(images[0], "stacked-media bleed-bottom-frame")}
    </section>
  `;
}

function renderTopTextBottomInset({
  piece,
  artist,
  pieceIndex,
  images = [],
  themeClasses,
  helpers,
  options,
}) {
  return `
    <section class="book-section stacked-template stacked-bottom-image stacked-bottom-inset ${themeClasses}">
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy")}
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
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 380 }, "split-copy")}
    </section>
  `;
}
