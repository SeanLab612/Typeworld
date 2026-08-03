import {describe, expect, it} from "vitest";
import {
  clampGrowthProgress,
  smoothGrowthProgress,
} from "../src/green-overgrowth";

describe("green overgrowth progress", () => {
  it("clamps invalid and out-of-range progress", () => {
    expect(clampGrowthProgress(Number.NaN)).toBe(0);
    expect(clampGrowthProgress(-1)).toBe(0);
    expect(clampGrowthProgress(0.42)).toBe(0.42);
    expect(clampGrowthProgress(2)).toBe(1);
  });

  it("uses a smooth reversible growth curve", () => {
    expect(smoothGrowthProgress(0)).toBe(0);
    expect(smoothGrowthProgress(0.5)).toBe(0.5);
    expect(smoothGrowthProgress(1)).toBe(1);
    expect(smoothGrowthProgress(0.25)).toBeCloseTo(0.15625);
  });
});
