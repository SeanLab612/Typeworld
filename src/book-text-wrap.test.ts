import {describe, expect, it} from "vitest";
import {wrapBookTextLines} from "./book-text-wrap";

const measure = (value: string): number => Array.from(value).length;

describe("book text wrapping", () => {
  it("keeps English words intact", () => {
    expect(wrapBookTextLines("TYPE A WORD AND PRESS ENTER.", 11, measure)).toEqual([
      "TYPE A WORD",
      "AND PRESS",
      "ENTER.",
    ]);
  });

  it("wraps Chinese copy without requiring spaces", () => {
    expect(wrapBookTextLines("更多变化藏在书架中。", 5, measure)).toEqual([
      "更多变化藏",
      "在书架中。",
    ]);
  });
});
