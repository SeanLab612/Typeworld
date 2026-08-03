import {describe, expect, it} from "vitest";
import {
  mobileKeyboardInset,
  reconcileMobileInput,
} from "./mobile-typewriter-input";

describe("mobile typewriter input", () => {
  it("routes appended English text as a mechanical insertion", () => {
    expect(reconcileMobileInput("fir", "fire")).toEqual({
      accepted: true,
      value: "fire",
      edit: {kind: "insert", text: "e"},
      reason: "accepted",
    });
  });

  it("accepts the final composition value before a mobile Enter submission", () => {
    expect(reconcileMobileInput("", "flower")).toEqual({
      accepted: true,
      value: "flower",
      edit: {kind: "insert", text: "flower"},
      reason: "accepted",
    });
  });

  it("routes end-anchored deletion as mechanical backspace", () => {
    expect(reconcileMobileInput("snow", "sn")).toEqual({
      accepted: true,
      value: "sn",
      edit: {kind: "backspace", count: 2},
      reason: "accepted",
    });
  });

  it("rejects completed non-English composition without changing the buffer", () => {
    expect(reconcileMobileInput("", "花")).toEqual({
      accepted: false,
      value: "",
      edit: null,
      reason: "unsupported-character",
    });
  });

  it("rejects edits in the middle of a mechanical line", () => {
    expect(reconcileMobileInput("fire", "fare")).toEqual({
      accepted: false,
      value: "fire",
      edit: null,
      reason: "mid-line-edit",
    });
  });
});

describe("mobile keyboard inset", () => {
  it("measures an overlay keyboard from the visual viewport", () => {
    expect(mobileKeyboardInset(844, 510, 0)).toBe(334);
  });

  it("accounts for a browser toolbar offset and never returns negative", () => {
    expect(mobileKeyboardInset(844, 780, 44)).toBe(20);
    expect(mobileKeyboardInset(800, 820, 0)).toBe(0);
  });
});
