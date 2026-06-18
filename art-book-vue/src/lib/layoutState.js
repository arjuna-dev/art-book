export function shouldIncludePiece(piece) {
  return piece.include_in_book !== false;
}

export function artworkKey(artist, piece) {
  return `${artist.artist_name}::${piece.art_piece_name}`;
}

export function normalizeTemplateId(
  templateId,
  { artworkTemplates, defaultArtworkTemplate },
) {
  const aliases = {
    "spread-image": "square-caption",
    "panorama-text": "artist-portrait",
    "padded-plate": "top-inset-text",
  };

  const normalized = aliases[templateId] ?? templateId;
  return artworkTemplates[normalized] ? normalized : defaultArtworkTemplate;
}

export function buildCatalogPieces(artData, imageForPiece) {
  return artData.flatMap((artist, artistIndex) => {
    let includedBefore = 0;

    for (let index = 0; index < artistIndex; index += 1) {
      includedBefore += artData[index].art_pieces.filter(shouldIncludePiece).length;
    }

    return artist.art_pieces
      .filter(shouldIncludePiece)
      .map((piece, pieceIndex) => ({
        ...piece,
        artist,
        pieceIndex,
        globalIndex: includedBefore + pieceIndex,
        key: artworkKey(artist, piece),
        image: imageForPiece(piece, artist),
      }));
  });
}

export function resolveArtworkKey(key, catalogPieceMap) {
  return key && catalogPieceMap.has(key) ? key : null;
}

export function resolveImageArtworkKey(key, catalogPieceMap) {
  if (key === null || key === "") return null;
  return resolveArtworkKey(key, catalogPieceMap);
}

export function normalizePageEntry(
  page,
  index,
  defaults,
  { catalogPieces, catalogPieceMap, artworkTemplates, defaultArtworkTemplate },
) {
  const template = normalizeTemplateId(page?.template ?? defaults.artworkTemplate, {
    artworkTemplates,
    defaultArtworkTemplate,
  });
  const fallbackPiece = catalogPieces[index % catalogPieces.length] ?? catalogPieces[0];
  const contentArtworkKey =
    resolveArtworkKey(page?.contentArtworkKey, catalogPieceMap) ??
    resolveArtworkKey(page?.imageArtworkKeys?.[0], catalogPieceMap) ??
    fallbackPiece?.key ??
    "";
  const hasImageArtworkKeys = Array.isArray(page?.imageArtworkKeys);
  const firstImageArtworkKey = hasImageArtworkKeys
    ? resolveImageArtworkKey(page.imageArtworkKeys[0], catalogPieceMap)
    : contentArtworkKey;
  const secondImageArtworkKey = hasImageArtworkKeys
    ? resolveImageArtworkKey(page.imageArtworkKeys[1], catalogPieceMap) ?? firstImageArtworkKey
    : firstImageArtworkKey;
  const imageArtworkKeys = [firstImageArtworkKey, secondImageArtworkKey];
  const oppositeCaptionPosition =
    page?.oppositeCaptionPosition === "after" ? "after" : "before";
  const templateSupportsAdjacentTombstone =
    artworkTemplates[template]?.supports?.adjacentTombstone === true;
  const adjacentTombstonePosition =
    page?.adjacentTombstonePosition === "next" ? "next" : "previous";
  const supportingTextPosition =
    page?.supportingTextPosition === "below" ? "below" : "above";
  const legacyImageRatioMode =
    page?.imageRatioMode === "portrait" ? "portrait" : "landscape";
  const imageRatioModes = Array.from({ length: 2 }, (_, slotIndex) =>
    page?.imageRatioModes?.[slotIndex] === "portrait"
      ? "portrait"
      : legacyImageRatioMode,
  );

  return {
    id: page?.id ?? `page-${index + 1}`,
    template,
    textColor: page?.textColor ?? defaults.textColor,
    backgroundColor: page?.backgroundColor ?? defaults.backgroundColor,
    contentArtworkKey,
    imageArtworkKeys,
    oppositeCaptionPage: page?.oppositeCaptionPage === true,
    oppositeCaptionPosition,
    adjacentTombstonePage:
      templateSupportsAdjacentTombstone && page?.adjacentTombstonePage === true,
    adjacentTombstonePosition,
    showTombstone: page?.showTombstone !== false,
    showImageTombstone: page?.showImageTombstone === true,
    showDescription: page?.showDescription !== false,
    showArtistDescription: page?.showArtistDescription === true,
    supportingTextPosition,
    imageRatioModes,
  };
}

export function normalizeCoverEntry(cover, defaults, { catalogPieces, catalogPieceMap }) {
  const fallbackPiece = catalogPieces[0];
  const hasImageArtworkKey = Object.hasOwn(cover ?? {}, "imageArtworkKey");
  const imageArtworkKey = hasImageArtworkKey
    ? resolveImageArtworkKey(cover.imageArtworkKey, catalogPieceMap)
    : fallbackPiece?.key ?? null;

  return {
    imageArtworkKey,
    textColor: cover?.textColor ?? "white",
    backgroundColor: cover?.backgroundColor ?? "black",
    title: cover?.title ?? "Speculative Works",
    kicker: cover?.kicker ?? "Studio edition",
    note:
      cover?.note ??
      "A page-based art book prototype for assigning templates, images, captions, and artist notes directly from the studio.",
  };
}

export function migrateLayoutState(
  savedLayout,
  {
    catalogPieces,
    catalogPieceMap,
    artworkTemplates,
    defaultArtworkTemplate,
  },
) {
  const defaults = {
    artworkTemplate: normalizeTemplateId(
      savedLayout?.defaults?.artworkTemplate ?? defaultArtworkTemplate,
      { artworkTemplates, defaultArtworkTemplate },
    ),
    textColor: savedLayout?.defaults?.textColor ?? "black",
    backgroundColor: savedLayout?.defaults?.backgroundColor ?? "paper",
  };
  const cover = normalizeCoverEntry(savedLayout?.cover, defaults, {
    catalogPieces,
    catalogPieceMap,
  });

  if (Array.isArray(savedLayout?.pages) && savedLayout.pages.length > 0) {
    return {
      version: 2,
      defaults,
      cover,
      pages: savedLayout.pages.map((page, index) =>
        normalizePageEntry(page, index, defaults, {
          catalogPieces,
          catalogPieceMap,
          artworkTemplates,
          defaultArtworkTemplate,
        }),
      ),
    };
  }

  const legacyArtworks = savedLayout?.artworks ?? {};

  return {
    version: 2,
    defaults,
    cover,
    pages: catalogPieces.map((piece, index) =>
      normalizePageEntry(
        {
          showTombstone: true,
          showImageTombstone: false,
          showDescription: true,
          showArtistDescription: false,
          supportingTextPosition: "above",
          imageRatioModes: ["landscape", "landscape"],
          ...(legacyArtworks[piece.key] ?? {}),
          contentArtworkKey: piece.key,
          imageArtworkKeys: [piece.key, piece.key],
        },
        index,
        defaults,
        {
          catalogPieces,
          catalogPieceMap,
          artworkTemplates,
          defaultArtworkTemplate,
        },
      ),
    ),
  };
}

export function createPageEntry(
  index,
  defaults,
  { catalogPieces, catalogPieceMap, artworkTemplates, defaultArtworkTemplate },
) {
  return normalizePageEntry(
    {
      template: defaultArtworkTemplate,
      showTombstone: true,
      showImageTombstone: false,
      showDescription: true,
      showArtistDescription: false,
      supportingTextPosition: "above",
      imageRatioModes: ["landscape", "landscape"],
    },
    index,
    defaults,
    { catalogPieces, catalogPieceMap, artworkTemplates, defaultArtworkTemplate },
  );
}

export function normalizedLayoutState(
  layoutState,
  { catalogPieces, catalogPieceMap, artworkTemplates, defaultArtworkTemplate },
) {
  const defaults = {
    artworkTemplate:
      layoutState.defaults?.artworkTemplate ?? defaultArtworkTemplate,
    textColor: layoutState.defaults?.textColor ?? "black",
    backgroundColor: layoutState.defaults?.backgroundColor ?? "paper",
  };

  return {
    version: 2,
    defaults,
    cover: normalizeCoverEntry(layoutState.cover, defaults, {
      catalogPieces,
      catalogPieceMap,
    }),
    pages: (layoutState.pages ?? []).map((page, index) =>
      normalizePageEntry(page, index, defaults, {
        catalogPieces,
        catalogPieceMap,
        artworkTemplates,
        defaultArtworkTemplate,
      }),
    ),
  };
}
