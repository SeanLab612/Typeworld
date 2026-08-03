import {describe, expect, it} from "vitest";
import {
  canBeginLibraryJourney,
  libraryJourneyAutoplayProgress,
  libraryJourneyBookProgress,
  libraryJourneyCameraProgress,
  nextLibraryJourneyTarget,
  nextLibrarySelectionIndex,
  shouldCompleteLibraryJourney,
  shouldRestoreLibraryHero,
} from "./library-journey";

describe("library journey", () => {
  it("starts only from an idle, loaded study or typing view", () => {
    const ready = {
      viewMode: "hero" as const,
      experienceMode: "typing" as const,
      loading: false,
      firstVisitBlocking: false,
    };
    expect(canBeginLibraryJourney(ready)).toBe(true);
    expect(canBeginLibraryJourney({...ready, viewMode: "typing"})).toBe(true);
    expect(canBeginLibraryJourney({...ready, viewMode: "archive"})).toBe(false);
    expect(canBeginLibraryJourney({...ready, experienceMode: "presented"})).toBe(false);
    expect(canBeginLibraryJourney({...ready, loading: true})).toBe(false);
    expect(canBeginLibraryJourney({...ready, firstVisitBlocking: true})).toBe(false);
  });

  it("maps wheel movement to a reversible, clamped target", () => {
    expect(nextLibraryJourneyTarget(0.4, 50)).toBeCloseTo(0.46);
    expect(nextLibraryJourneyTarget(0.4, -50)).toBeCloseTo(0.34);
    expect(nextLibraryJourneyTarget(0.98, 500)).toBe(1);
    expect(nextLibraryJourneyTarget(0.02, -500)).toBe(0);
  });

  it("plays explicit entry with a slow eased timeline", () => {
    expect(libraryJourneyAutoplayProgress(0.008, 0, 3600)).toBeCloseTo(0.008);
    expect(libraryJourneyAutoplayProgress(0.008, 1800, 3600)).toBeCloseTo(0.504);
    expect(libraryJourneyAutoplayProgress(0.008, 3600, 3600)).toBe(1);
    expect(libraryJourneyAutoplayProgress(0.2, 100, 0)).toBe(1);
  });

  it("finishes the camera before the seven books complete their stagger", () => {
    expect(libraryJourneyCameraProgress(0)).toBe(0);
    expect(libraryJourneyCameraProgress(0.64)).toBe(1);
    expect(libraryJourneyBookProgress(0.35, 0, 7)).toBeGreaterThan(0);
    expect(libraryJourneyBookProgress(0.35, 6, 7)).toBe(0);
    expect(libraryJourneyBookProgress(1, 0, 7)).toBe(1);
    expect(libraryJourneyBookProgress(1, 6, 7)).toBe(1);
  });

  it("routes only after both target and displayed progress reach the end", () => {
    expect(shouldCompleteLibraryJourney(1, 0.98)).toBe(false);
    expect(shouldCompleteLibraryJourney(0.98, 1)).toBe(false);
    expect(shouldCompleteLibraryJourney(1, 0.995)).toBe(true);
  });

  it("restores Hero only after the reverse timeline reaches its origin", () => {
    expect(shouldRestoreLibraryHero(0, 0.005)).toBe(true);
    expect(shouldRestoreLibraryHero(0, 0.12)).toBe(false);
    expect(shouldRestoreLibraryHero(0.1, 0)).toBe(false);
  });

  it("clamps volume selection at both ends", () => {
    expect(nextLibrarySelectionIndex(0, -1, 7)).toBe(0);
    expect(nextLibrarySelectionIndex(0, 1, 7)).toBe(1);
    expect(nextLibrarySelectionIndex(6, 1, 7)).toBe(6);
  });
});
