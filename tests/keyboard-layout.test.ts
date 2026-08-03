import {describe, expect, it} from "vitest";
import keyboard from "../specs/keyboard-layout.json";

describe("Phase 1 keyboard layout", () => {
  it("freezes 52 unique controls and 47 independent typebar keys", () => {
    const ids = keyboard.keys.map((key) => key.id);
    const codes = keyboard.keys.map((key) => key.code);
    const printable = keyboard.keys.filter((key) => key.kind === "print");

    expect(keyboard.keys).toHaveLength(52);
    expect(printable).toHaveLength(47);
    expect(new Set(ids).size).toBe(52);
    expect(new Set(codes).size).toBe(52);
  });

  it("keeps Space printable without assigning it a typebar", () => {
    const space = keyboard.keys.find((key) => key.id === "SPACE");

    expect(space).toMatchObject({
      code: "Space",
      base: " ",
      shift: " ",
      kind: "space",
    });
  });
});
