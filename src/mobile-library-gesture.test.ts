import {describe, expect, it} from "vitest";
import {
  mobileLibrarySelectionDirection,
  sampleMobileLibraryPageDrag,
  shouldCommitMobileLibraryPage,
} from "./mobile-library-gesture";

describe("mobile library gestures", () => {
  it("maps a left drag to a proportional forward page turn", () => {
    expect(sampleMobileLibraryPageDrag(-140, 12, 390, true, true)).toEqual({
      direction: 1,
      progress: 140 / (390 * 0.72),
      horizontal: true,
    });
  });

  it("maps a right drag to a backward page turn", () => {
    expect(sampleMobileLibraryPageDrag(120, 8, 390, true, true).direction).toBe(-1);
  });

  it("does not turn beyond either end of the book", () => {
    expect(sampleMobileLibraryPageDrag(120, 0, 390, false, true).direction).toBe(0);
    expect(sampleMobileLibraryPageDrag(-120, 0, 390, true, false).direction).toBe(0);
  });

  it("ignores mostly vertical movement", () => {
    expect(sampleMobileLibraryPageDrag(-40, 80, 390, true, true)).toEqual({
      direction: 0,
      progress: 0,
      horizontal: false,
    });
  });

  it("commits by distance or by a deliberate fast flick", () => {
    expect(shouldCommitMobileLibraryPage(0.4, -110, 600)).toBe(true);
    expect(shouldCommitMobileLibraryPage(0.18, -36, 50)).toBe(true);
    expect(shouldCommitMobileLibraryPage(0.18, -36, 500)).toBe(false);
  });

  it("changes the selected book only after a vertical swipe", () => {
    expect(mobileLibrarySelectionDirection(12, -80)).toBe(1);
    expect(mobileLibrarySelectionDirection(12, 80)).toBe(-1);
    expect(mobileLibrarySelectionDirection(80, 12)).toBe(0);
  });
});
