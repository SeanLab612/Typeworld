import {describe, expect, it} from "vitest";
import {
  getRelativeProjectBookIndex,
  normalizeProjectBookIndex,
  PROJECT_BOOKS,
} from "../src/project-books-data";
import {createProjectBookNodeNames} from "../src/project-book-spec";

describe("project books collection", () => {
  it("keeps stable unique ids and four category volumes", () => {
    expect(PROJECT_BOOKS).toHaveLength(4);
    expect(new Set(PROJECT_BOOKS.map((book) => book.id)).size).toBe(PROJECT_BOOKS.length);
    expect(PROJECT_BOOKS.map((book) => book.id)).toEqual([
      "guide",
      "machine",
      "paper",
      "your-words",
    ]);
  });

  it("publishes seven short bilingual pages in every category volume", () => {
    const populated = PROJECT_BOOKS.filter((book) => book.kind === "project");
    expect(populated).toHaveLength(4);
    expect(populated.every((book) => book.pages.length === 7)).toBe(true);
    expect(populated.every((book) => book.pages.every((page) => (
      page.section.includes("/")
      && page.paragraphs.some((paragraph) => /\p{Script=Han}/u.test(paragraph))
    )))).toBe(true);
    expect(populated.every((book) => book.links.length === 0 && book.media.length === 0)).toBe(true);
  });

  it("contains no mock or placeholder project copy", () => {
    const serialized = JSON.stringify(PROJECT_BOOKS).toLowerCase();
    expect(serialized).not.toContain("mock");
    expect(serialized).not.toContain("placeholder");
    expect(serialized).not.toContain("github");
    expect(serialized).not.toContain("legacy-private-account");
    expect(serialized).not.toContain("sean");
    expect(serialized).not.toContain("contact");
  });

  it("wraps selection indexes in both directions", () => {
    expect(normalizeProjectBookIndex(-1)).toBe(PROJECT_BOOKS.length - 1);
    expect(normalizeProjectBookIndex(PROJECT_BOOKS.length)).toBe(0);
  });

  it("uses the shortest wrapped relative slot", () => {
    expect(getRelativeProjectBookIndex(3, 0)).toBe(-1);
    expect(getRelativeProjectBookIndex(0, 3)).toBe(1);
  });

  it("creates stable independent node names per book", () => {
    const nameSets = PROJECT_BOOKS.map((book) => Object.values(createProjectBookNodeNames(book.id)));
    const allNames = nameSets.flat();
    expect(new Set(allNames).size).toBe(allNames.length);
    expect(nameSets.every((names) => names.some((name) => name.endsWith("_HIT_PROXY")))).toBe(true);
  });
});
