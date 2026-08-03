import {describe, expect, it} from "vitest";
import {createShelfBookLayout} from "../src/shelf-book-layout";

describe("shelf book layout", () => {
  it("is deterministic and uses all four approved cloth colors", () => {
    const first = createShelfBookLayout();
    expect(createShelfBookLayout()).toEqual(first);
    expect(first.length).toBeGreaterThanOrEqual(24);
    expect(new Set(first.map((book) => book.colorIndex))).toEqual(new Set([0, 1, 2, 3]));
  });

  it("keeps every book inside the source shelf bounds", () => {
    for (const book of createShelfBookLayout()) {
      expect(book.x).toBeGreaterThan(0);
      expect(book.x).toBeLessThan(1);
      expect(book.y).toBeGreaterThan(0.38);
      expect(book.y).toBeLessThan(2.05);
      expect(book.z).toBeGreaterThan(0.13);
      expect(book.z).toBeLessThan(0.19);
    }
  });
});
