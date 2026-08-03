import {describe, expect, it} from "vitest";
import {samplePaperDeformation} from "../src/paper-surface";

describe("Phase 4 flexible paper", () => {
  it("keeps deterministic center deformation and curls the edges", () => {
    const center = samplePaperDeformation(0, 0.7, 2, 0);
    const edge = samplePaperDeformation(1, 0.7, 2, 0);

    expect(samplePaperDeformation(0, 0.7, 2, 0)).toEqual(center);
    expect(edge.depthOffset).toBeGreaterThan(center.depthOffset);
  });

  it("adds bounded carriage flutter only while active", () => {
    const resting = samplePaperDeformation(0.35, 0.55, 0, 0);
    const moving = samplePaperDeformation(0.35, 0.55, 0, 1);

    expect(Math.abs(moving.depthOffset - resting.depthOffset)).toBeLessThanOrEqual(0.0012);
  });
});
