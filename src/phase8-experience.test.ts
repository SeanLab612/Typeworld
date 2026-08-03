import {describe, expect, it} from "vitest";

import {
  ExperienceDirector,
  findSceneCommand,
  resolveSceneInputHandoff,
} from "./phase8-experience";

describe("phase 8 scene keyword routing", () => {
  it.each([
    ["green", "green"],
    [" snow ", "snow"],
    ["FLOWER", "flower"],
  ] as const)("recognizes %s as the %s effect", (input, expectedScene) => {
    expect(findSceneCommand(input)?.scene).toBe(expectedScene);
  });

  it("rejects partial words", () => {
    expect(findSceneCommand("greenery")).toBeNull();
    expect(findSceneCommand("snow flower")).toBeNull();
  });

  it("enters each effect from idle and accepts input again after exit", () => {
    for (const scene of ["green", "snow", "flower"] as const) {
      const director = new ExperienceDirector(100);
      expect(director.enter(scene, 0)).toBe(true);
      expect(director.update(100).phase).toBe("active");
      expect(resolveSceneInputHandoff("active", "physical")).toBe("begin-exit");
      expect(director.exit(120)).toBe(true);
      expect(director.update(220)).toMatchObject({phase: "idle", scene: null});
    }
  });
});
