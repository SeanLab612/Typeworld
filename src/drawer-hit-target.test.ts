import {describe, expect, it} from "vitest";
import {drawerHitTargetLayout} from "./drawer-hit-target";

describe("vendor drawer hit targets", () => {
  it("moves the clickable region with each drawer", () => {
    const leftClosed = drawerHitTargetLayout("left", 0, 0);
    const leftOpen = drawerHitTargetLayout("left", 0, 1);
    const rightClosed = drawerHitTargetLayout("right", 0, 0);
    const rightOpen = drawerHitTargetLayout("right", 0, 1);

    expect(leftOpen.position[2] - leftClosed.position[2]).toBeCloseTo(0.39);
    expect(rightOpen.position[2] - rightClosed.position[2]).toBeCloseTo(0.325);
  });

  it("clamps animation progress and keeps separate left/right zones", () => {
    expect(drawerHitTargetLayout("left", 0.4, -1))
      .toEqual(drawerHitTargetLayout("left", 0.4, 0));
    expect(drawerHitTargetLayout("right", 0.4, 2))
      .toEqual(drawerHitTargetLayout("right", 0.4, 1));
    expect(drawerHitTargetLayout("left", 0, 0).position[0]).toBeLessThan(0);
    expect(drawerHitTargetLayout("right", 0, 0).position[0]).toBeGreaterThan(0);
  });
});
