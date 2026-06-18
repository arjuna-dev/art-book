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
  {
    id: "two-image-diagonal-left",
    label: "Two images: top left, bottom right",
  },
  {
    id: "two-image-diagonal-right",
    label: "Two images: top right, bottom left",
  },
];

export const colorClass = (colorId, prefix) =>
  `${prefix}-${colorId || "paper"}`;

export const defaultArtworkTemplate = "square-caption";

export const artworkTemplates = {
  "artist-portrait": {
    label: "Artist portrait",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      usesArtistPortrait: true,
      imageTombstone: true,
      adjacentTombstone: true,
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
      adjacentTombstone: true,
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
      adjacentTombstone: true,
    },
    render: renderTopBleedText,
  },
  "top-inset-text": {
    label: "Inset image top, text bottom",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderTopInsetText,
  },
  "left-image-text": {
    label: "Inset image left, text right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderLeftImageText,
  },
  "left-bleed-image-text": {
    label: "Bleed image left, text right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderLeftBleedImageText,
  },
  "right-image-text": {
    label: "Text left, inset image right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderRightImageText,
  },
  "right-bleed-image-text": {
    label: "Text left, bleed image right",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderRightBleedImageText,
  },
  "top-text-bottom-bleed": {
    label: "Text top, bleed image bottom",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderTopTextBottomBleed,
  },
  "top-text-bottom-inset": {
    label: "Text top, inset image bottom",
    supports: {
      captions: true,
      imageSlots: 1,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderTopTextBottomInset,
  },
  "two-image-diagonal-left": {
    label: "Two images: top left, bottom right",
    supports: {
      captions: true,
      imageSlots: 2,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderTwoImageDiagonalLeft,
  },
  "two-image-diagonal-right": {
    label: "Two images: top right, bottom left",
    supports: {
      captions: true,
      imageSlots: 2,
      physicalPages: 1,
      adjacentTombstone: true,
    },
    render: renderTwoImageDiagonalRight,
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
      ${renderCaptionBlock(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 620, oppositeCaption: true, oppositeCaptionPosition: position }, "caption-lead-copy")}
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

  if (options?.showArtistDescription === true) {
    const artistDescription = truncateText(
      artist.artist_introduction,
      options?.artistDescriptionLimit,
    );
    blocks.push(
      `<h3 class="artist-name-header">${escapeHtml(artist.artist_name)}</h3>
      <p class="artist-description">${escapeHtml(artistDescription)}</p>`,
    );
  }

  if (!isArtistPage && options?.showDescription !== false) {
    const description = truncateText(
      piece.long_description || piece.short_description,
      options?.descriptionLimit,
    );
    blocks.push(
      `<p>${escapeHtml(description)}</p>`,
    );
  }

  const tombstone =
    !isArtistPage && options?.showTombstone !== false
      ? `<p class="tombstone-line"><strong class="tombstone-title">${escapeHtml(piece.art_piece_name)}</strong>, ${escapeHtml(piece.year)}, ${escapeHtml(piece.technique_used)}</p>`
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

function truncateText(value, limit) {
  const text = String(value ?? "").trim();
  if (!Number.isFinite(limit) || limit <= 0 || text.length <= limit) {
    return text;
  }

  const clipped = text.slice(0, limit).trimEnd();
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?"),
  );
  const wordEnd = clipped.lastIndexOf(" ");
  const end = sentenceEnd > limit * 0.55 ? sentenceEnd + 1 : wordEnd;

  return `${clipped.slice(0, end > 0 ? end : limit).trimEnd()}...`;
}

function renderAdjacentTombstone(adjacentTombstone, helpers) {
  const { escapeHtml } = helpers;
  const { direction, piece, artist } = adjacentTombstone;
  const label = direction === "next" ? "(next)" : "(previous)";

  return `
    <aside class="adjacent-tombstone adjacent-${direction}">
      <p class="tombstone-line">${label} <strong class="tombstone-title">${escapeHtml(piece.art_piece_name)}</strong>, ${escapeHtml(piece.year)}, ${escapeHtml(piece.technique_used)}</p>
    </aside>
  `;
}

function renderInlineImageTombstone(piece, helpers, className = "") {
  const { escapeHtml } = helpers;
  const classAttr = className ? ` ${className}` : "";
  return `
    <aside class="image-tombstone${classAttr}">
      <p class="tombstone-line"><strong class="tombstone-title">${escapeHtml(piece.art_piece_name)}</strong>, ${escapeHtml(piece.year)}, ${escapeHtml(piece.technique_used)}</p>
    </aside>
  `;
}

function adjacentClassForOptions(options) {
  const adjacentDirection = options?.adjacentTombstone?.direction ?? null;
  return adjacentDirection
    ? ` has-adjacent-tombstone adjacent-${adjacentDirection}`
    : "";
}

function renderAdjacentForOptions(options, helpers) {
  return options?.adjacentTombstone
    ? renderAdjacentTombstone(options.adjacentTombstone, helpers)
    : "";
}

function renderTombstoneRail(piece, artist, pieceIndex, helpers, options, className) {
  const textPositionClass =
    options?.supportingTextPosition === "below"
      ? " supporting-text-below"
      : " supporting-text-above";
  return `
    <div class="${className}${textPositionClass}">
      ${renderCaptionBlock(
        piece,
        artist,
        pieceIndex,
        helpers,
        { ...options, adjacentTombstone: null },
        "tombstone-rail-copy",
      )}
      ${renderAdjacentForOptions(options, helpers)}
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

function renderArtistPortrait({
  piece,
  artist,
  pieceIndex,
  images = [],
  artistPortrait,
  themeClasses,
  helpers,
  options,
}) {
  const image = images?.[0] ?? artistPortrait;
  const imageTombstone =
    options?.showImageTombstone === true
      ? renderInlineImageTombstone(piece, helpers, "artist-portrait-image-tombstone")
      : "";
  const adjacentTombstone =
    options?.showTombstone !== false ? renderAdjacentForOptions(options, helpers) : "";

  return `
    <section class="book-section artist-portrait-page ${themeClasses}">
      <div class="artist-portrait-copy">
        ${renderCaptionBlock(piece, artist, pieceIndex, helpers, {
          ...options,
          artistDescriptionLimit: 760,
          descriptionLimit: 760,
          showTombstone: false,
        })}
        ${adjacentTombstone}
      </div>
      <div class="artist-portrait-media">
        ${renderImageFrame(image, "artist-portrait-frame")}
        ${imageTombstone}
      </div>
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
  const adjacentClass = adjacentClassForOptions(options);

  return `
    <section class="book-section square-caption-page ${themeClasses}${adjacentClass}">
      ${renderImageFrame(images[0], "square-caption-frame")}
      ${renderTombstoneRail(
        piece,
        artist,
        pieceIndex,
        helpers,
        { ...options, descriptionLimit: 300 },
        "square-caption-copy tombstone-pair",
      )}
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
  const adjacentClass = adjacentClassForOptions(options);

  return `
    <section class="book-section big-square-caption-page ${themeClasses}${adjacentClass}">
      ${renderImageFrame(images[0], "big-square-caption-frame")}
      ${renderTombstoneRail(
        piece,
        artist,
        pieceIndex,
        helpers,
        options,
        "big-square-caption-copy tombstone-pair",
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
  const adjacentClass = adjacentClassForOptions(options);

  return `
    <section class="book-section stacked-template stacked-bleed-top ${themeClasses}${adjacentClass}">
      ${renderImageFrame(images[0], "stacked-media bleed-top-frame")}
      ${renderTombstoneRail(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy tombstone-pair")}
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
  const adjacentClass = adjacentClassForOptions(options);

  return `
    <section class="book-section stacked-template stacked-inset-top ${themeClasses}${adjacentClass}">
      ${renderImageFrame(images[0], "stacked-media inset-frame")}
      ${renderTombstoneRail(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy tombstone-pair")}
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
  const adjacentClass = adjacentClassForOptions(options);

  return `
    <section class="book-section stacked-template stacked-bottom-image stacked-bottom-bleed ${themeClasses}${adjacentClass}">
      ${renderTombstoneRail(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy tombstone-pair")}
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
  const adjacentClass = adjacentClassForOptions(options);

  return `
    <section class="book-section stacked-template stacked-bottom-image stacked-bottom-inset ${themeClasses}${adjacentClass}">
      ${renderTombstoneRail(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: 360 }, "stacked-copy tombstone-pair")}
      ${renderImageFrame(images[0], "stacked-media inset-frame")}
    </section>
  `;
}

function renderTwoImageDiagonalLeft(input) {
  return renderTwoImageDiagonalTemplate({
    ...input,
    className: "two-image-diagonal diagonal-left",
  });
}

function renderTwoImageDiagonalRight(input) {
  return renderTwoImageDiagonalTemplate({
    ...input,
    className: "two-image-diagonal diagonal-right",
  });
}

function renderTwoImageDiagonalTemplate({
  piece,
  artist,
  pieceIndex,
  images = [],
  imagePieces = [],
  themeClasses,
  helpers,
  options,
  className,
}) {
  const adjacentClass = adjacentClassForOptions(options);
  const firstPiece = imagePieces[0] ?? piece;
  const secondPiece = imagePieces[1] ?? piece;
  const ratioA =
    options?.imageRatioModes?.[0] === "portrait" ? "ratio-portrait" : "ratio-landscape";
  const ratioB =
    options?.imageRatioModes?.[1] === "portrait" ? "ratio-portrait" : "ratio-landscape";
  const ratioPairClass =
    ratioA === "ratio-portrait" && ratioB === "ratio-portrait"
      ? "both-portrait"
      : "mixed-ratio";
  const diagonalOptions = {
    ...options,
    showArtistDescription: false,
    descriptionLimit: 220,
  };

  return `
    <section class="book-section ${className} ${ratioPairClass} ${themeClasses}${adjacentClass}">
      <div class="diagonal-item diagonal-item-a ${ratioA}">
        ${renderImageFrame(images[0], "diagonal-frame")}
        ${renderTombstoneRail(firstPiece, firstPiece.artist ?? artist, pieceIndex, helpers, diagonalOptions, "diagonal-copy tombstone-pair")}
      </div>
      <div class="diagonal-item diagonal-item-b ${ratioB}">
        ${renderImageFrame(images[1], "diagonal-frame")}
        ${renderTombstoneRail(secondPiece, secondPiece.artist ?? artist, pieceIndex, helpers, { ...diagonalOptions, adjacentTombstone: null }, "diagonal-copy")}
      </div>
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
  const adjacentClass = adjacentClassForOptions(options);
  const splitTextBlockCount =
    (options?.showDescription !== false ? 1 : 0) +
    (options?.showArtistDescription === true ? 1 : 0);
  const splitTextLimit = splitTextBlockCount > 1 ? 640 : 1520;

  return `
    <section class="book-section ${className} ${themeClasses}${adjacentClass}">
      ${renderImageFrame(image, "split-media")}
      ${renderTombstoneRail(piece, artist, pieceIndex, helpers, { ...options, descriptionLimit: splitTextLimit, artistDescriptionLimit: splitTextLimit }, "split-copy tombstone-pair")}
    </section>
  `;
}
