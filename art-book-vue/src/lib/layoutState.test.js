import { describe, expect, it } from "vitest";
import {
  artworkKey,
  buildCatalogPieces,
  createPageEntry,
  migrateLayoutState,
  normalizedLayoutState,
  normalizePageEntry,
  normalizeTemplateId,
} from "./layoutState";

const artworkTemplates = {
  "square-caption": { supports: { physicalPages: 1, adjacentTombstone: true } },
  "artist-portrait": { supports: { physicalPages: 1, adjacentTombstone: false } },
  "top-inset-text": { supports: { physicalPages: 1, adjacentTombstone: false } },
  "full-bleed-caption": { supports: { physicalPages: 2, adjacentTombstone: false } },
};

const defaultArtworkTemplate = "square-caption";

const artData = [
  {
    artist_name: "Artist One",
    artist_introduction: "Intro one",
    art_pieces: [
      {
        art_piece_name: "Shown One",
        include_in_book: true,
      },
      {
        art_piece_name: "Hidden One",
        include_in_book: false,
      },
    ],
  },
  {
    artist_name: "Artist Two",
    artist_introduction: "Intro two",
    art_pieces: [
      {
        art_piece_name: "Shown Two",
      },
    ],
  },
];

function createHelpers() {
  const catalogPieces = buildCatalogPieces(artData, (piece, artist) => ({
    src: `/images/${artist.artist_name}/${piece.art_piece_name}.png`,
  }));
  const catalogPieceMap = new Map(catalogPieces.map((piece) => [piece.key, piece]));

  return {
    catalogPieces,
    catalogPieceMap,
    artworkTemplates,
    defaultArtworkTemplate,
  };
}

describe("layoutState", () => {
  it("builds catalog pieces only for included artwork and keeps global ordering", () => {
    const { catalogPieces } = createHelpers();

    expect(catalogPieces).toHaveLength(2);
    expect(catalogPieces.map((piece) => piece.key)).toEqual([
      "Artist One::Shown One",
      "Artist Two::Shown Two",
    ]);
    expect(catalogPieces.map((piece) => piece.globalIndex)).toEqual([0, 1]);
  });

  it("normalizes legacy template ids to current registry ids", () => {
    expect(
      normalizeTemplateId("spread-image", {
        artworkTemplates,
        defaultArtworkTemplate,
      }),
    ).toBe("square-caption");
    expect(
      normalizeTemplateId("padded-plate", {
        artworkTemplates,
        defaultArtworkTemplate,
      }),
    ).toBe("top-inset-text");
    expect(
      normalizeTemplateId("missing-template", {
        artworkTemplates,
        defaultArtworkTemplate,
      }),
    ).toBe(defaultArtworkTemplate);
  });

  it("migrates legacy artwork layout data into v2 page entries", () => {
    const helpers = createHelpers();
    const shownOneKey = artworkKey(artData[0], artData[0].art_pieces[0]);
    const state = migrateLayoutState(
      {
        version: 1,
        defaults: {
          artworkTemplate: "padded-plate",
          textColor: "white",
          backgroundColor: "black",
        },
        artworks: {
          [shownOneKey]: {
            template: "panorama-text",
            showDescription: false,
          },
        },
      },
      helpers,
    );

    expect(state.version).toBe(2);
    expect(state.defaults).toEqual({
      artworkTemplate: "top-inset-text",
      textColor: "white",
      backgroundColor: "black",
    });
    expect(state.cover).toMatchObject({
      imageArtworkKey: shownOneKey,
      textColor: "white",
      backgroundColor: "black",
      title: "Speculative Works",
    });
    expect(state.pages).toHaveLength(2);
    expect(state.pages[0]).toMatchObject({
      contentArtworkKey: shownOneKey,
      imageArtworkKeys: [shownOneKey, shownOneKey],
      template: "artist-portrait",
      showDescription: false,
      showTombstone: true,
      showArtistDescription: false,
    });
  });

  it("normalizes invalid page artwork references back to a valid fallback", () => {
    const helpers = createHelpers();
    const page = normalizePageEntry(
      {
        template: "full-bleed-caption",
        contentArtworkKey: "missing",
        imageArtworkKeys: ["missing-a", "missing-b"],
      },
      1,
      {
        artworkTemplate: defaultArtworkTemplate,
        textColor: "black",
        backgroundColor: "paper",
      },
      helpers,
    );

    expect(page.contentArtworkKey).toBe("Artist Two::Shown Two");
    expect(page.imageArtworkKeys).toEqual([null, null]);
    expect(page.template).toBe("full-bleed-caption");
  });

  it("preserves explicit no-image selections", () => {
    const helpers = createHelpers();
    const page = normalizePageEntry(
      {
        contentArtworkKey: "Artist One::Shown One",
        imageArtworkKeys: [null, ""],
      },
      0,
      {
        artworkTemplate: defaultArtworkTemplate,
        textColor: "black",
        backgroundColor: "paper",
      },
      helpers,
    );

    expect(page.contentArtworkKey).toBe("Artist One::Shown One");
    expect(page.imageArtworkKeys).toEqual([null, null]);
  });

  it("creates and reserializes page entries with stable defaults", () => {
    const helpers = createHelpers();
    const baseDefaults = {
      artworkTemplate: defaultArtworkTemplate,
      textColor: "black",
      backgroundColor: "paper",
    };
    const newPage = createPageEntry(0, baseDefaults, helpers);
    const serialized = normalizedLayoutState(
      {
        defaults: baseDefaults,
        cover: {
          imageArtworkKey: "",
          textColor: "lime",
          backgroundColor: "black",
        },
        pages: [
          newPage,
          {
            ...newPage,
            id: "page-2",
            template: "spread-image",
            textColor: "white",
          },
        ],
      },
      helpers,
    );

    expect(serialized.cover).toMatchObject({
      imageArtworkKey: null,
      textColor: "lime",
      backgroundColor: "black",
    });
    expect(newPage).toMatchObject({
      id: "page-1",
      template: "square-caption",
      textColor: "black",
      backgroundColor: "paper",
      imageArtworkKeys: ["Artist One::Shown One", "Artist One::Shown One"],
      oppositeCaptionPage: false,
      oppositeCaptionPosition: "before",
      adjacentTombstonePage: false,
      adjacentTombstonePosition: "previous",
      showTombstone: true,
      showDescription: true,
      showArtistDescription: false,
    });
    expect(serialized.pages[1]).toMatchObject({
      id: "page-2",
      template: "square-caption",
      textColor: "white",
      backgroundColor: "paper",
      oppositeCaptionPage: false,
      oppositeCaptionPosition: "before",
      adjacentTombstonePage: false,
      adjacentTombstonePosition: "previous",
    });
  });

  it("persists full-bleed opposite caption page options", () => {
    const helpers = createHelpers();
    const page = normalizePageEntry(
      {
        template: "full-bleed-caption",
        contentArtworkKey: "Artist One::Shown One",
        oppositeCaptionPage: true,
        oppositeCaptionPosition: "after",
      },
      0,
      {
        artworkTemplate: defaultArtworkTemplate,
        textColor: "black",
        backgroundColor: "paper",
      },
      helpers,
    );

    expect(page.oppositeCaptionPage).toBe(true);
    expect(page.oppositeCaptionPosition).toBe("after");
  });

  it("persists adjacent tombstone reference options", () => {
    const helpers = createHelpers();
    const page = normalizePageEntry(
      {
        template: "square-caption",
        contentArtworkKey: "Artist One::Shown One",
        adjacentTombstonePage: true,
        adjacentTombstonePosition: "next",
      },
      0,
      {
        artworkTemplate: defaultArtworkTemplate,
        textColor: "black",
        backgroundColor: "paper",
      },
      helpers,
    );

    expect(page.adjacentTombstonePage).toBe(true);
    expect(page.adjacentTombstonePosition).toBe("next");
  });

  it("disables adjacent tombstone on templates that do not support it", () => {
    const helpers = createHelpers();
    const page = normalizePageEntry(
      {
        template: "top-inset-text",
        contentArtworkKey: "Artist One::Shown One",
        adjacentTombstonePage: true,
        adjacentTombstonePosition: "next",
      },
      0,
      {
        artworkTemplate: defaultArtworkTemplate,
        textColor: "black",
        backgroundColor: "paper",
      },
      helpers,
    );

    expect(page.adjacentTombstonePage).toBe(false);
    expect(page.adjacentTombstonePosition).toBe("next");
  });
});
