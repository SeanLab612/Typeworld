import {describe, expect, it} from "vitest";
import {
  ExperienceDirector,
  findSceneCommand,
  resolveSceneInputHandoff,
  sceneCommandArchiveDefinition,
} from "../src/phase8-experience";

describe("Phase 8 experience direction", () => {
  it("hands new input off by exiting the active effect and buffering during exit", () => {
    expect(resolveSceneInputHandoff("active", "physical")).toBe("begin-exit");
    expect(resolveSceneInputHandoff("active", "pointer")).toBe("begin-exit");
    expect(resolveSceneInputHandoff("exiting", "physical")).toBe("defer");
    expect(resolveSceneInputHandoff("active", "auto")).toBe("normal");
    expect(resolveSceneInputHandoff("idle", "physical")).toBe("normal");
  });

  it("registers the implemented green, snow, and flower scene commands", () => {
    expect(findSceneCommand(" GREEN ")?.scene).toBe("green");
    expect(findSceneCommand(" snow ")?.scene).toBe("snow");
    expect(findSceneCommand(" flower ")?.scene).toBe("flower");
    expect(findSceneCommand("school")).toBeNull();
  });

  it("creates a non-mock archive definition for the first scene discovery", () => {
    const green = findSceneCommand("green");
    expect(green).not.toBeNull();
    if (!green) return;
    expect(sceneCommandArchiveDefinition(green)).toMatchObject({
      keyword: "green",
      title: "GREEN / OVERGROWTH",
      mock: false,
    });
  });

  it("creates a non-mock snow archive definition", () => {
    const snow = findSceneCommand("snow");
    expect(snow).not.toBeNull();
    if (!snow) return;
    expect(sceneCommandArchiveDefinition(snow)).toMatchObject({
      keyword: "snow",
      title: "SNOW / FROST",
      mock: false,
    });
  });

  it("creates a non-mock flower archive definition", () => {
    const flower = findSceneCommand("flower");
    expect(flower).not.toBeNull();
    if (!flower) return;
    expect(sceneCommandArchiveDefinition(flower)).toMatchObject({
      keyword: "flower",
      title: "FLOWER / URSINIA",
      mock: false,
    });
  });

  it("keeps the reversible overgrowth active throughout entry and unlocks when active", () => {
    const director = new ExperienceDirector(1000);
    expect(director.enter("green", 100)).toBe(true);
    expect(director.update(500)).toMatchObject({
      phase: "entering",
      environmentVisible: true,
      inputLocked: true,
    });
    expect(director.update(600)).toMatchObject({
      phase: "entering",
      environmentVisible: true,
      inputLocked: true,
    });
    expect(director.update(1100)).toMatchObject({
      phase: "active",
      environmentVisible: true,
      inputLocked: false,
    });
  });

  it("keeps the overgrowth visible while it recedes and removes it at idle", () => {
    const director = new ExperienceDirector(1000);
    director.enter("green", 0);
    director.update(1000);
    expect(director.exit(1200)).toBe(true);
    expect(director.update(1600).environmentVisible).toBe(true);
    expect(director.update(1700).environmentVisible).toBe(true);
    expect(director.update(2200)).toMatchObject({
      phase: "idle",
      scene: null,
      environmentVisible: false,
      inputLocked: false,
    });
  });
});
