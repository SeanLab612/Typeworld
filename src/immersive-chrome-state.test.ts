import {describe, expect, it} from "vitest";
import {
  immersiveChromeMessage,
  isImmersiveChromeMessage,
  isShellActivityMessage,
  SHELL_ACTIVITY_MESSAGE,
  shouldHideImmersiveChrome,
  type ImmersiveChromeContext,
} from "./immersive-chrome-state";

const eligible: ImmersiveChromeContext = {
  viewMode: "hero",
  experienceMode: "typing",
  idleForMs: 4000,
  idleThresholdMs: 4000,
  coarsePointer: false,
  controlFocused: false,
  loading: false,
};

describe("immersive chrome state", () => {
  it("hides only an idle desktop Hero", () => {
    expect(shouldHideImmersiveChrome(eligible)).toBe(true);
    expect(shouldHideImmersiveChrome({...eligible, viewMode: "library"})).toBe(false);
    expect(shouldHideImmersiveChrome({...eligible, viewMode: "typing"})).toBe(false);
    expect(shouldHideImmersiveChrome({...eligible, viewMode: "archive"})).toBe(false);
    expect(shouldHideImmersiveChrome({...eligible, experienceMode: "presented"})).toBe(false);
  });

  it("keeps controls visible for activity, focus, loading, and touch", () => {
    expect(shouldHideImmersiveChrome({...eligible, idleForMs: 3999})).toBe(false);
    expect(shouldHideImmersiveChrome({...eligible, controlFocused: true})).toBe(false);
    expect(shouldHideImmersiveChrome({...eligible, coarsePointer: true})).toBe(false);
    expect(shouldHideImmersiveChrome({...eligible, loading: true})).toBe(false);
  });

  it("validates the narrow parent-shell message contract", () => {
    expect(isImmersiveChromeMessage(immersiveChromeMessage(true))).toBe(true);
    expect(isImmersiveChromeMessage({type: "typeworld:immersive-chrome", hidden: "yes"})).toBe(false);
    expect(isImmersiveChromeMessage({type: "unrelated", hidden: true})).toBe(false);
    expect(isShellActivityMessage({type: SHELL_ACTIVITY_MESSAGE})).toBe(true);
    expect(isShellActivityMessage({type: "unrelated"})).toBe(false);
  });
});
