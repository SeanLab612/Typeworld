import {describe, expect, it} from "vitest";
import {
  drawerTravel,
  lampFlicker,
  smoothEnvironmentProgress,
} from "../src/phase6-environment";

describe("Phase 6 environment motion", () => {
  it("keeps drawer travel bounded and monotonic", () => {
    expect(drawerTravel(-1, 0.34)).toBe(0);
    expect(drawerTravel(0.5, 0.34)).toBeCloseTo(0.17);
    expect(drawerTravel(2, 0.34)).toBeCloseTo(0.34);
  });

  it("approaches its target without overshooting", () => {
    const opened = smoothEnvironmentProgress(0, 1, 1 / 60);
    const closed = smoothEnvironmentProgress(1, 0, 1 / 60);
    expect(opened).toBeGreaterThan(0);
    expect(opened).toBeLessThan(1);
    expect(closed).toBeGreaterThan(0);
    expect(closed).toBeLessThan(1);
  });

  it("keeps lamp flicker subtle", () => {
    for (let frame = 0; frame < 240; frame += 1) {
      expect(lampFlicker(frame / 60)).toBeGreaterThan(0.94);
      expect(lampFlicker(frame / 60)).toBeLessThan(1.06);
    }
  });
});
