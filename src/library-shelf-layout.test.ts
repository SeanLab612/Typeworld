import {describe, expect, it} from "vitest";
import {selectLibraryShelfIndices} from "./library-shelf-layout";

describe("library shelf selection", () => {
  it("spreads four readable volumes across the real shelf", () => {
    expect(selectLibraryShelfIndices(4)).toEqual([1, 9, 17, 25]);
  });

  it("supports a growing library without exceeding the seven reserved slots", () => {
    expect(selectLibraryShelfIndices(0)).toEqual([]);
    expect(selectLibraryShelfIndices(1)).toEqual([13]);
    expect(selectLibraryShelfIndices(20)).toHaveLength(7);
  });
});
