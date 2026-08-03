import {describe, expect, it} from "vitest";
import {soundPlanForKey} from "../src/typewriter-audio";
import type {TypewriterKey} from "../src/typewriter-state";

function key(kind: TypewriterKey["kind"]): TypewriterKey {
  return {id: kind.toUpperCase(), code: kind, base: null, shift: null, kind};
}

describe("Phase 5 sound plan", () => {
  it("keeps strike and carriage cues tied to printable keys", () => {
    expect(soundPlanForKey(key("print"))).toEqual({
      start: "key",
      imprint: "strike",
      finish: "carriage",
    });
  });

  it("assigns distinct mechanical cues without external audio assets", () => {
    expect(soundPlanForKey(key("space")).start).toBe("space");
    expect(soundPlanForKey(key("backspace")).start).toBe("backspace");
    expect(soundPlanForKey(key("enter"))).toMatchObject({start: "return", imprint: "paper"});
    expect(soundPlanForKey(key("modifier")).imprint).toBeNull();
  });
});
