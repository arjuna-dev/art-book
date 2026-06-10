import { describe, expect, it } from "vitest";
import {
  artworkTemplates,
  renderOppositeCaptionSpread,
} from "./artworkTemplates";

const helpers = {
  escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  },
};

const artist = {
  artist_name: "Ada Painter",
  artist_introduction: "Ada builds large quiet works.",
};

const piece = {
  art_piece_name: "Blue Study",
  long_description: "A piece description that belongs on artwork pages.",
  short_description: "Short description.",
  year: "2026",
  technique_used: "Oil",
  display_context: "Studio",
};

describe("artworkTemplates", () => {
  it("renders artist portrait pages as artist pages, not artwork pages", () => {
    const html = artworkTemplates["artist-portrait"].render({
      piece,
      artist,
      pieceIndex: 0,
      artistPortrait: { src: "/portrait.png" },
      themeClasses: "bg-paper text-black",
      helpers,
      options: {
        showDescription: true,
        showTombstone: true,
        showArtistDescription: true,
      },
    });

    expect(html).toContain("Ada Painter</h3>");
    expect(html).toContain("Ada builds large quiet works.");
    expect(html).not.toContain("<h2>Blue Study</h2>");
    expect(html).not.toContain(
      "A piece description that belongs on artwork pages.",
    );
    expect(html).not.toContain("tombstone-block");
  });

  it("renders captions without artwork headers", () => {
    const html = artworkTemplates["square-caption"].render({
      piece,
      artist,
      pieceIndex: 1,
      images: [{ src: "/image.png" }],
      themeClasses: "bg-paper text-black",
      helpers,
      options: {
        showDescription: true,
        showTombstone: true,
      },
    });

    expect(html).not.toContain("<h2>");
    expect(html).not.toContain("artwork-number");
    expect(html).toContain("tombstone-line");
    expect(html).toContain("tombstone-title");
    expect(html).toContain("Blue Study</strong>, 2026, Oil");
  });

  it("renders a compact tombstone for a neighboring artwork", () => {
    const html = artworkTemplates["square-caption"].render({
      piece,
      artist,
      pieceIndex: 1,
      images: [{ src: "/image.png" }],
      themeClasses: "bg-paper text-black",
      helpers,
      options: {
        showDescription: true,
        showTombstone: true,
        adjacentTombstone: {
          direction: "previous",
          piece: {
            ...piece,
            art_piece_name: "Previous Work",
            year: "2025",
          },
          artist,
        },
      },
    });

    expect(html).toContain("caption-block-main");
    expect(html).toContain("has-adjacent-tombstone adjacent-previous");
    expect(html).toContain("adjacent-tombstone adjacent-previous");
    expect(html).toContain(
      '(opposite) <strong class="tombstone-title">Previous Work</strong>, 2025, Oil',
    );
    expect(html).toContain("Blue Study");
    expect(html).toContain(
      'section class="book-section square-caption-page bg-paper text-black has-adjacent-tombstone adjacent-previous"',
    );
    expect(html.indexOf("</div>")).toBeLessThan(
      html.indexOf('<aside class="adjacent-tombstone adjacent-previous">'),
    );
  });

  it("places a next-page neighboring tombstone after the main caption copy", () => {
    const html = artworkTemplates["square-caption"].render({
      piece,
      artist,
      pieceIndex: 1,
      images: [{ src: "/image.png" }],
      themeClasses: "bg-paper text-black",
      helpers,
      options: {
        showDescription: true,
        showTombstone: true,
        adjacentTombstone: {
          direction: "next",
          piece: {
            ...piece,
            art_piece_name: "Next Work",
          },
          artist,
        },
      },
    });

    expect(html).toContain("has-adjacent-tombstone adjacent-next");
    expect(html).toContain("adjacent-tombstone adjacent-next");
    expect(html).toContain(
      '(opposite) <strong class="tombstone-title">Next Work</strong>',
    );
    expect(html).toContain(
      'section class="book-section square-caption-page bg-paper text-black has-adjacent-tombstone adjacent-next"',
    );
    expect(html.indexOf("</div>")).toBeLessThan(
      html.indexOf('<aside class="adjacent-tombstone adjacent-next">'),
    );
  });

  it("renders an opposite caption spread before or after a full bleed image", () => {
    const beforeHtml = renderOppositeCaptionSpread({
      position: "before",
      piece,
      artist,
      pieceIndex: 0,
      images: [{ src: "/image.png" }],
      themeClasses: "bg-black text-white",
      helpers,
      options: { showDescription: true, showTombstone: true },
    });
    const afterHtml = renderOppositeCaptionSpread({
      position: "after",
      piece,
      artist,
      pieceIndex: 0,
      images: [{ src: "/image.png" }],
      themeClasses: "bg-black text-white",
      helpers,
      options: { showDescription: true, showTombstone: true },
    });

    expect(beforeHtml.indexOf("caption-lead-page")).toBeLessThan(
      beforeHtml.indexOf("full-bleed-page"),
    );
    expect(afterHtml.indexOf("full-bleed-page")).toBeLessThan(
      afterHtml.indexOf("caption-lead-page"),
    );
    expect(beforeHtml).toContain('class="full-bleed-media" src="/image.png"');
  });
});
