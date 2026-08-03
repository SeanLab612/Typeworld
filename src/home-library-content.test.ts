import {describe, expect, it} from "vitest";
import {
  DEFAULT_HOME_ENTRIES,
  findDefaultHomeEntry,
  PUBLIC_STARTER_WORDS,
} from "./home-library-content";

describe("home library content", () => {
  it("exposes only the five completed starter words", () => {
    expect(PUBLIC_STARTER_WORDS).toEqual([
      "green",
      "snow",
      "flower",
      "fire",
      "smile",
    ]);
  });

  it("replaces the personal default navigation with guide, words, and library", () => {
    expect(DEFAULT_HOME_ENTRIES.map((entry) => entry.id)).toEqual([
      "guide",
      "words",
      "library",
    ]);
    expect(findDefaultHomeEntry("library")?.action).toBe("library");
    expect(findDefaultHomeEntry("projects")).toBeNull();
  });
});
