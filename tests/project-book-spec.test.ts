import {describe, expect, it} from "vitest";
import {
  PROJECT_BOOK_DIMENSIONS,
  PROJECT_BOOK_NODE_NAMES,
  PROJECT_BOOK_REVIEW_VIEWS,
} from "../src/project-book-spec";

describe("project book sample contract", () => {
  it("keeps every reviewable book component independently named", () => {
    const names = Object.values(PROJECT_BOOK_NODE_NAMES);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("BOOK_TYPEWORLD_COVER_FRONT");
    expect(names).toContain("BOOK_TYPEWORLD_COVER_BACK");
    expect(names).toContain("BOOK_TYPEWORLD_SPINE");
    expect(names).toContain("BOOK_TYPEWORLD_PAGES");
    expect(names).toContain("BOOK_TYPEWORLD_HIT_PROXY");
  });

  it("preserves physical cover overhang and a recessed page block", () => {
    expect(PROJECT_BOOK_DIMENSIONS.coverOverhang).toBeGreaterThan(0);
    expect(PROJECT_BOOK_DIMENSIONS.coverThickness).toBeGreaterThan(0);
    expect(PROJECT_BOOK_DIMENSIONS.pageDepth).toBeGreaterThan(
      PROJECT_BOOK_DIMENSIONS.coverThickness * 2,
    );
  });

  it("exposes the four P1 review views", () => {
    expect(PROJECT_BOOK_REVIEW_VIEWS).toEqual([
      "three-quarter",
      "front",
      "spine",
      "pages",
    ]);
  });
});
