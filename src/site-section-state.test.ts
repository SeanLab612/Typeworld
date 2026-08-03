import {describe, expect, it} from "vitest";
import {shouldCloseSelectedDrawer} from "./site-section-state";

describe("site section drawer toggle", () => {
  it("closes when the requested drawer is selected or physically open", () => {
    expect(shouldCloseSelectedDrawer("left", true, "left")).toBe(true);
    expect(shouldCloseSelectedDrawer("left", false, "left")).toBe(true);
    expect(shouldCloseSelectedDrawer(null, true, "left")).toBe(true);
  });

  it("does not close an inactive, closed drawer", () => {
    expect(shouldCloseSelectedDrawer("left", false, "right")).toBe(false);
    expect(shouldCloseSelectedDrawer(null, false, "left")).toBe(false);
  });
});
