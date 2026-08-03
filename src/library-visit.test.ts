import {describe, expect, it} from "vitest";
import {
  hasVisitedLibrary,
  LIBRARY_VISITED_STORAGE_KEY,
  LIBRARY_VISITED_VERSION,
  markLibraryVisited,
} from "./library-visit";

describe("library visit persistence", () => {
  it("keeps the cue emphasized until the library has actually been visited", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(hasVisitedLibrary(storage)).toBe(false);
    expect(markLibraryVisited(storage)).toBe(true);
    expect(values.get(LIBRARY_VISITED_STORAGE_KEY)).toBe(LIBRARY_VISITED_VERSION);
    expect(hasVisitedLibrary(storage)).toBe(true);
  });

  it("falls back to an emphasized cue when storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasVisitedLibrary(storage)).toBe(false);
    expect(markLibraryVisited(storage)).toBe(false);
  });
});
