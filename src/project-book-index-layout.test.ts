import {describe, expect, it} from "vitest";
import {projectBookIndexPose} from "./project-book-index-layout";

describe("project book index layout", () => {
  it("keeps the approved selected-book pose", () => {
    expect(projectBookIndexPose(0)).toEqual({
      position: [0.12, -0.02, 0.52],
      rotation: [-0.04, -0.18, -0.035],
      scale: 0.83,
    });
  });

  it("stacks surrounding books symmetrically with uniform pose scales", () => {
    const previous = projectBookIndexPose(-2);
    const next = projectBookIndexPose(2);
    expect(previous.position[1]).toBeCloseTo(0.96);
    expect(next.position[1]).toBeCloseTo(-0.96);
    expect(previous.scale).toBe(next.scale);
    expect(previous.rotation[0]).toBeCloseTo(-1.12);
    expect(next.rotation[2]).toBeCloseTo(Math.PI / 2);
  });
});
