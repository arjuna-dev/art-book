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

export function normalizePageEntry(
  page,
  index,
  defaults,
  { catalogPieces, catalogPieceMap, artworkTemplates, defaultArtworkTemplate },
) {
  const fallbackPiece = catalogPieces[index % catalogPieces.length] ?? catalogPieces[0];
  const contentArtworkKey =
    resolveArtworkKey(page?.contentArtworkKey, catalogPieceMap) ??
    resolveArtworkKey(page?.imageArtworkKeys?.[0], catalogPieceMap) ??
    fallbackPiece?.key ??
    "";
  const imageArtworkKeys = [
    resolveArtworkKey(page?.imageArtworkKeys?.[0], catalogPieceMap) ?? contentArtworkKey,
    resolveArtworkKey(page?.imageArtworkKeys?.[1], catalogPieceMap) ??
      resolveArtworkKey(page?.imageArtworkKeys?.[0], catalogPieceMap) ??
      contentArtworkKey,
  ];

  return {
    id: page?.id ?? `page-${index + 1}`,
    template: normalizeTemplateId(page?.template ?? defaults.artworkTemplate, {
      artworkTemplates,
      defaultArtworkTemplate,
    }),
    textColor: page?.textColor ?? defaults.textColor,
    backgroundColor: page?.backgroundColor ?? defaults.backgroundColor,
    contentArtworkKey,
    imageArtworkKeys,
    showTombstone: page?.showTombstone !== false,
    showDescription: page?.showDescription !== false,
    showArtistDescription: page?.showArtistDescription === true,
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

  if (Array.isArray(savedLayout?.pages) && savedLayout.pages.length > 0) {
    return {
      version: 2,
      defaults,
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
    pages: catalogPieces.map((piece, index) =>
      normalizePageEntry(
        {
          showTombstone: true,
          showDescription: true,
          showArtistDescription: false,
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
      showDescription: true,
      showArtistDescription: false,
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
