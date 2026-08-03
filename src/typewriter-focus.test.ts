import {describe, expect, it} from "vitest";
import {
  canRouteTypewriterExperienceInput,
  shouldRouteTypewriterKey,
} from "./typewriter-focus";

describe("typewriter keyboard focus routing", () => {
  it("lets the first physical or pointer input replace a completed smile paper", () => {
    expect(canRouteTypewriterExperienceInput("smiling", false, true)).toBe(true);
    expect(canRouteTypewriterExperienceInput("smiling", false, false)).toBe(false);
    expect(canRouteTypewriterExperienceInput("typing", false, false)).toBe(true);
    expect(canRouteTypewriterExperienceInput("blocked", true, false)).toBe(true);
  });

  it("routes every mapped key when the page or canvas owns focus", () => {
    expect(shouldRouteTypewriterKey("other", "print")).toBe(true);
    expect(shouldRouteTypewriterKey("other", "space")).toBe(true);
    expect(shouldRouteTypewriterKey("other", "enter")).toBe(true);
  });

  it("routes text and backspace away from non-editing controls", () => {
    expect(shouldRouteTypewriterKey("control", "print")).toBe(true);
    expect(shouldRouteTypewriterKey("control", "backspace")).toBe(true);
  });

  it("preserves activation keys for buttons and sliders", () => {
    expect(shouldRouteTypewriterKey("control", "space")).toBe(false);
    expect(shouldRouteTypewriterKey("control", "enter")).toBe(false);
    expect(shouldRouteTypewriterKey("control", "modifier")).toBe(false);
  });

  it("never intercepts typing in an editable field", () => {
    expect(shouldRouteTypewriterKey("editing", "print")).toBe(false);
    expect(shouldRouteTypewriterKey("editing", "backspace")).toBe(false);
    expect(shouldRouteTypewriterKey("editing", "enter")).toBe(false);
  });
});
