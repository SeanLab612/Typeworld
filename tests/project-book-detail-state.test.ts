import {describe, expect, it} from "vitest";
import {
  clampProjectBookPageIndex,
  getProjectBookPageLabel,
  parseProjectBookDetailQuery,
  PROJECT_BOOK_DETAIL_LEAF_COUNT,
} from "../src/project-book-detail-state";

describe("project book detail state", () => {
  it("clamps page turns to the available leaf count", () => {
    expect(clampProjectBookPageIndex(-2)).toBe(0);
    expect(clampProjectBookPageIndex(2)).toBe(2);
    expect(clampProjectBookPageIndex(99)).toBe(PROJECT_BOOK_DETAIL_LEAF_COUNT);
  });

  it("formats the visible spread label", () => {
    expect(getProjectBookPageLabel(0)).toBe("01 / 04");
    expect(getProjectBookPageLabel(PROJECT_BOOK_DETAIL_LEAF_COUNT)).toBe("04 / 04");
  });

  it("restores open-book page state from the route", () => {
    expect(parseProjectBookDetailQuery("?open=1&page=2"))
      .toEqual({open: true, pageIndex: 2});
    expect(parseProjectBookDetailQuery("?open=0&page=99"))
      .toEqual({open: false, pageIndex: PROJECT_BOOK_DETAIL_LEAF_COUNT});
  });
});
