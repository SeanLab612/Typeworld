import {describe, expect, it} from "vitest";
import {
  extendPaperFromBottom,
  TYPING_PAPER_LAYOUT,
} from "../src/typing-paper-layout";

describe("typing paper layout", () => {
  it("extends a 180 mm sheet to 225 mm while keeping the platen edge fixed", () => {
    const bottom = -0.09;
    const top = 0.09;

    expect(extendPaperFromBottom(bottom, bottom)).toBeCloseTo(bottom);
    expect(extendPaperFromBottom(top, bottom)).toBeCloseTo(0.135);
    expect((top - bottom) * TYPING_PAPER_LAYOUT.heightScale).toBeCloseTo(0.225);
  });

  it("gives the large type more breathing room between strikes", () => {
    expect(TYPING_PAPER_LAYOUT.fontSize).toBeGreaterThan(82);
    expect(TYPING_PAPER_LAYOUT.characterStep).toBe(42);
    expect(TYPING_PAPER_LAYOUT.glyphMaxWidth).toBeLessThanOrEqual(
      TYPING_PAPER_LAYOUT.characterStep + 16,
    );
  });
});
