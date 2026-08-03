import {describe, expect, it} from "vitest";
import {mechanismDurationMs} from "./typewriter-input-timing";
import type {QueuedInput, TypewriterKey} from "./typewriter-state";

const letter: TypewriterKey = {
  id: "A",
  code: "KeyA",
  base: "a",
  shift: "A",
  kind: "print",
};
const enter: TypewriterKey = {
  id: "ENTER",
  code: "Enter",
  base: null,
  shift: null,
  kind: "enter",
};

function input(key: TypewriterKey, source: QueuedInput["source"]): QueuedInput {
  return {key, shifted: false, source};
}

describe("typewriter mechanism catch-up timing", () => {
  it("keeps automated demonstrations on their authored cadence", () => {
    expect(mechanismDurationMs(input(letter, "auto"), 8)).toBe(95);
    expect(mechanismDurationMs(input(enter, "auto"), 8)).toBe(190);
  });

  it("accelerates physical strikes as the mechanical queue grows", () => {
    expect(mechanismDurationMs(input(letter, "physical"), 0)).toBe(220);
    expect(mechanismDurationMs(input(letter, "physical"), 3)).toBe(145);
    expect(mechanismDurationMs(input(letter, "physical"), 8)).toBe(105);
  });

  it("preserves a slower carriage return while allowing it to catch up", () => {
    expect(mechanismDurationMs(input(enter, "physical"), 0)).toBe(520);
    expect(mechanismDurationMs(input(enter, "physical"), 5)).toBe(320);
  });
});
