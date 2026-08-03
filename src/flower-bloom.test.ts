import {describe, expect, it} from "vitest";
import {
  clampFlowerProgress,
  FLOWER_PLACEMENTS,
  resolveFlowerBloomQuality,
} from "./flower-bloom";

describe("flower bloom", () => {
  it("clamps transition progress safely", () => {
    expect(clampFlowerProgress(-1)).toBe(0);
    expect(clampFlowerProgress(0.45)).toBe(0.45);
    expect(clampFlowerProgress(2)).toBe(1);
    expect(clampFlowerProgress(Number.NaN)).toBe(0);
  });

  it("uses a reduced profile for reduced motion and low-core devices", () => {
    expect(resolveFlowerBloomQuality(true, 12)).toBe("reduced");
    expect(resolveFlowerBloomQuality(false, 4)).toBe("reduced");
    expect(resolveFlowerBloomQuality(false, 8)).toBe("full");
  });

  it("keeps all flower clusters in exterior side and base lanes", () => {
    expect(FLOWER_PLACEMENTS.length).toBeGreaterThanOrEqual(10);
    for (const placement of FLOWER_PLACEMENTS) {
      const [x, y, z] = placement.position;
      expect(z).toBeGreaterThanOrEqual(0.5);
      expect(y).toBeLessThanOrEqual(0.42);
      expect(x <= 0.22 || x >= 0.78).toBe(true);
    }
  });
});
