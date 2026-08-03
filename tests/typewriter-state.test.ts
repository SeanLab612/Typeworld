import {describe, expect, it} from "vitest";
import {
  applyTypewriterKey,
  createTypewriterState,
  InputQueue,
  paperText,
  type QueuedInput,
  type TypewriterKey,
} from "../src/typewriter-state";
import keyboard from "../specs/keyboard-layout.json";

const letterA: TypewriterKey = {
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
const backspace: TypewriterKey = {
  id: "BACKSPACE",
  code: "Backspace",
  base: null,
  shift: null,
  kind: "backspace",
};

describe("Phase 4 typewriter state", () => {
  it("imprints shifted and unshifted characters exactly once", () => {
    const first = applyTypewriterKey(createTypewriterState(), letterA, false);
    const second = applyTypewriterKey(first.state, letterA, true);

    expect(first.effects.imprint).toBe("a");
    expect(second.effects.imprint).toBe("A");
    expect(paperText(second.state)).toBe("aA");
    expect(second.state.column).toBe(2);
  });

  it("deletes the previous character and writes into the cleared position", () => {
    const typed = applyTypewriterKey(createTypewriterState(), letterA, false);
    const backed = applyTypewriterKey(typed.state, backspace, false);
    const overwritten = applyTypewriterKey(backed.state, letterA, true);

    expect(paperText(backed.state)).toBe("");
    expect(paperText(overwritten.state)).toBe("A");
  });

  it("does not reverse-feed into the previous line at column zero", () => {
    const firstLine = applyTypewriterKey(createTypewriterState(), letterA, false);
    const secondLine = applyTypewriterKey(firstLine.state, enter, false);
    const backed = applyTypewriterKey(secondLine.state, backspace, false);

    expect(backed.state).toBe(secondLine.state);
    expect(paperText(backed.state)).toBe("a");
  });

  it("returns the carriage, advances paper, and rings once per line", () => {
    let state = createTypewriterState(8, 3);
    let bellCount = 0;
    for (let index = 0; index < 8; index += 1) {
      const result = applyTypewriterKey(state, letterA, false);
      state = result.state;
      if (result.effects.bell) bellCount += 1;
    }
    expect(bellCount).toBe(1);

    const returned = applyTypewriterKey(state, enter, false);
    expect(returned.state).toMatchObject({column: 0, row: 1, paperFeedLines: 1});
    expect(returned.effects.lineFeed).toBe(true);
    expect(returned.state.bellRungThisLine).toBe(false);
  });

  it("extends the paper beyond its initial grid until the configured limit", () => {
    let state = createTypewriterState(8, 3, 5);
    for (let row = 0; row < 4; row += 1) {
      state = applyTypewriterKey(state, letterA, false).state;
      state = applyTypewriterKey(state, enter, false).state;
    }
    state = applyTypewriterKey(state, letterA, false).state;

    expect(state.rows).toBe(5);
    expect(state.row).toBe(4);
    expect(paperText(state)).toBe("a\na\na\na\na");

    const capped = applyTypewriterKey(state, enter, false);
    expect(capped.state).toBe(state);
    expect(capped.effects.lineFeed).toBe(false);
  });

  it("preserves FIFO order and rejects overflow", () => {
    const queue = new InputQueue(2);
    const first: QueuedInput = {key: letterA, shifted: false, source: "physical"};
    const second: QueuedInput = {key: letterA, shifted: true, source: "pointer"};

    expect(queue.enqueue(first)).toBe(true);
    expect(queue.enqueue(second)).toBe(true);
    expect(queue.enqueue(first)).toBe(false);
    expect(queue.snapshot()).toEqual([first, second]);
    expect(queue.dequeue()).toBe(first);
    expect(queue.snapshot()).toEqual([second]);
    expect(queue.dequeue()).toBe(second);
  });

  it("accepts every frozen printable, space, modifier, return, and backspace control", () => {
    for (const rawKey of keyboard.keys) {
      const key = rawKey as TypewriterKey;
      const result = applyTypewriterKey(createTypewriterState(), key, true);
      if (key.kind === "print") {
        expect(result.effects.imprint, key.id).toBe(key.shift);
      } else if (key.kind === "space") {
        expect(result.effects.imprint, key.id).toBe(" ");
      } else if (key.kind === "enter") {
        expect(result.effects.lineFeed, key.id).toBe(true);
      } else if (key.kind === "modifier") {
        expect(result.state.shiftLatched, key.id).toBe(true);
      } else {
        expect(result.effects.imprint, key.id).toBeNull();
      }
    }
  });
});
