import {describe, expect, it, vi} from "vitest";
import {
  FIRST_VISIT_GREETING,
  FIRST_VISIT_MOBILE_GREETING,
  FIRST_VISIT_DESKTOP_READY_MESSAGE,
  FIRST_VISIT_MOBILE_READY_MESSAGE,
  FIRST_VISIT_STORAGE_KEY,
  FIRST_VISIT_VERSION,
  firstVisitMechanismDuration,
  isFirstVisitSpotlightActive,
  markFirstVisitOnboardingSeen,
  shouldRunFirstVisitOnboarding,
  shouldDismissFirstVisitForLibrary,
} from "./first-visit-onboarding";

describe("first visit onboarding", () => {
  it("keeps the approved three-line greeting", () => {
    expect(FIRST_VISIT_GREETING).toBe([
      "HELLO, STRANGER.",
      "TYPE ANYTHING YOU LIKE.",
      "SOME WORDS MAY CHANGE THE ROOM.",
      "THE LIBRARY WAITS BELOW.",
    ].join("\n"));
  });

  it("uses an explicit Library instruction instead of the removed mobile scroll cue", () => {
    expect(FIRST_VISIT_MOBILE_GREETING).toContain("SOME WORDS MAY CHANGE THE ROOM.");
    expect(FIRST_VISIT_MOBILE_GREETING).toContain("TAP LIBRARY TO ENTER.");
    expect(FIRST_VISIT_MOBILE_GREETING).not.toContain("BELOW");
  });

  it("keeps every mobile welcome line inside the five-line paper capacity", () => {
    const lines = FIRST_VISIT_MOBILE_GREETING.split("\n");
    expect(lines).toHaveLength(4);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(35);
    expect(lines).toContain("SOME WORDS MAY CHANGE THE ROOM.");
  });

  it("runs once for the current onboarding version", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(shouldRunFirstVisitOnboarding(storage)).toBe(true);
    expect(markFirstVisitOnboardingSeen(storage)).toBe(true);
    expect(values.get(FIRST_VISIT_STORAGE_KEY)).toBe(FIRST_VISIT_VERSION);
    expect(shouldRunFirstVisitOnboarding(storage)).toBe(false);
  });

  it("can be suppressed for QA and return routes", () => {
    const storage = {getItem: vi.fn(() => null), setItem: vi.fn()};
    expect(shouldRunFirstVisitOnboarding(storage, true)).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it("still permits an in-session welcome when storage is unavailable", () => {
    const storage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(shouldRunFirstVisitOnboarding(storage)).toBe(true);
    expect(markFirstVisitOnboardingSeen(storage)).toBe(false);
  });

  it("holds the entrance spotlight only through the welcome typing", () => {
    expect(isFirstVisitSpotlightActive("scheduled")).toBe(true);
    expect(isFirstVisitSpotlightActive("typing")).toBe(true);
    expect(isFirstVisitSpotlightActive("waiting")).toBe(false);
    expect(isFirstVisitSpotlightActive("replacing")).toBe(false);
    expect(isFirstVisitSpotlightActive("complete")).toBe(false);
  });

  it("finishes the mechanical welcome sooner on mobile without changing desktop timing", () => {
    expect(firstVisitMechanismDuration(95, false)).toBe(95);
    expect(firstVisitMechanismDuration(95, true)).toBe(40);
    expect(firstVisitMechanismDuration(60, true)).toBe(36);
  });

  it("offers an explicit acceleration path without changing normal timing", () => {
    expect(firstVisitMechanismDuration(95, false, true)).toBe(24);
    expect(firstVisitMechanismDuration(160, true, true)).toBe(38);
  });

  it("points judges to one concrete word and the library", () => {
    expect(FIRST_VISIT_DESKTOP_READY_MESSAGE).toContain("GREEN");
    expect(FIRST_VISIT_DESKTOP_READY_MESSAGE).toContain("书架");
    expect(FIRST_VISIT_MOBILE_READY_MESSAGE).toContain("GREEN");
    expect(FIRST_VISIT_MOBILE_READY_MESSAGE).toContain("LIBRARY");
  });

  it("lets an explicit Library choice remove only the temporary welcome", () => {
    expect(shouldDismissFirstVisitForLibrary("scheduled")).toBe(true);
    expect(shouldDismissFirstVisitForLibrary("typing")).toBe(true);
    expect(shouldDismissFirstVisitForLibrary("waiting")).toBe(true);
    expect(shouldDismissFirstVisitForLibrary("replacing")).toBe(true);
    expect(shouldDismissFirstVisitForLibrary("off")).toBe(false);
    expect(shouldDismissFirstVisitForLibrary("complete")).toBe(false);
  });
});
