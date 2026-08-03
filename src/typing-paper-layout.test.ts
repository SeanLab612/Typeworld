import {describe, expect, it} from "vitest";

import {
  glyphHorizontalScale,
  isSafariBrowser,
  mobileTypingPaperRowWindow,
  typingPaperLayoutForBrowser,
  typingPaperRowWindow,
  TYPING_PAPER_MOBILE_LAYOUT,
  TYPING_PAPER_LAYOUT,
  TYPING_PAPER_SAFARI_LAYOUT,
  TYPING_PAPER_SAFARI_MOBILE_LAYOUT,
} from "./typing-paper-layout";

describe("mobile typing paper layout", () => {
  it("fits five larger mobile lines inside the paper's useful texture area", () => {
    expect(TYPING_PAPER_MOBILE_LAYOUT.visibleRows).toBe(5);
    expect(TYPING_PAPER_MOBILE_LAYOUT.fontSize).toBe(72);
    expect(mobileTypingPaperRowWindow(4, 12)).toEqual({firstRow: 0, lastRow: 4});
    const fifthBaseline = TYPING_PAPER_MOBILE_LAYOUT.textTop
      + TYPING_PAPER_MOBILE_LAYOUT.lineStep * 4;
    expect(fifthBaseline).toBeLessThanOrEqual(
      TYPING_PAPER_MOBILE_LAYOUT.canvasHeight * 0.5,
    );
  });

  it("uses a smaller dynamic texture without changing the desktop layout", () => {
    expect(TYPING_PAPER_MOBILE_LAYOUT.canvasWidth).toBe(768);
    expect(TYPING_PAPER_MOBILE_LAYOUT.canvasHeight).toBe(512);
    expect(
      TYPING_PAPER_MOBILE_LAYOUT.canvasWidth * TYPING_PAPER_MOBILE_LAYOUT.canvasHeight,
    ).toBe(TYPING_PAPER_LAYOUT.canvasWidth * TYPING_PAPER_LAYOUT.canvasHeight / 4);
    expect(TYPING_PAPER_LAYOUT.canvasWidth).toBe(1536);
    expect(TYPING_PAPER_LAYOUT.canvasHeight).toBe(1024);
  });

  it("scrolls the five-line mobile window when the sixth line begins", () => {
    expect(mobileTypingPaperRowWindow(5, 12)).toEqual({firstRow: 1, lastRow: 5});
    expect(mobileTypingPaperRowWindow(11, 12)).toEqual({firstRow: 7, lastRow: 11});
  });

  it("scrolls the five-line desktop window when the sixth line begins", () => {
    expect(TYPING_PAPER_LAYOUT.visibleRows).toBe(5);
    expect(typingPaperRowWindow(4, 12, TYPING_PAPER_LAYOUT.visibleRows))
      .toEqual({firstRow: 0, lastRow: 4});
    expect(typingPaperRowWindow(5, 12, TYPING_PAPER_LAYOUT.visibleRows))
      .toEqual({firstRow: 1, lastRow: 5});
    expect(typingPaperRowWindow(17, 18, TYPING_PAPER_LAYOUT.visibleRows))
      .toEqual({firstRow: 13, lastRow: 17});
  });

  it("uses relaxed five-line Safari baselines without changing Chrome layouts", () => {
    expect(typingPaperLayoutForBrowser(false, false)).toBe(TYPING_PAPER_LAYOUT);
    expect(typingPaperLayoutForBrowser(true, false)).toBe(TYPING_PAPER_MOBILE_LAYOUT);
    expect(typingPaperLayoutForBrowser(false, true)).toBe(TYPING_PAPER_SAFARI_LAYOUT);
    expect(typingPaperLayoutForBrowser(true, true)).toBe(TYPING_PAPER_SAFARI_MOBILE_LAYOUT);
    expect(
      TYPING_PAPER_SAFARI_LAYOUT.textTop
        + TYPING_PAPER_SAFARI_LAYOUT.lineStep * 4,
    ).toBeLessThanOrEqual(TYPING_PAPER_SAFARI_LAYOUT.canvasHeight * 0.82);
    expect(
      TYPING_PAPER_SAFARI_MOBILE_LAYOUT.textTop
        + TYPING_PAPER_SAFARI_MOBILE_LAYOUT.lineStep * 4,
    ).toBeLessThanOrEqual(TYPING_PAPER_SAFARI_MOBILE_LAYOUT.canvasHeight * 0.82);
    expect(TYPING_PAPER_SAFARI_LAYOUT.textTop).toBe(TYPING_PAPER_LAYOUT.textTop);
    expect(TYPING_PAPER_SAFARI_LAYOUT.lineStep).toBe(TYPING_PAPER_LAYOUT.lineStep);
    expect(TYPING_PAPER_SAFARI_MOBILE_LAYOUT.textTop).toBe(
      Math.round(TYPING_PAPER_SAFARI_LAYOUT.textTop / 2),
    );
    expect(TYPING_PAPER_SAFARI_MOBILE_LAYOUT.lineStep).toBe(
      Math.round(TYPING_PAPER_SAFARI_LAYOUT.lineStep / 2),
    );
    expect(TYPING_PAPER_SAFARI_MOBILE_LAYOUT.fontSize)
      .toBeGreaterThan(TYPING_PAPER_MOBILE_LAYOUT.fontSize);
  });

  it("detects Safari without changing Chrome-family rendering", () => {
    expect(isSafariBrowser(
      "Mozilla/5.0 Version/18.5 Safari/605.1.15",
      "Apple Computer, Inc.",
    )).toBe(true);
    expect(isSafariBrowser(
      "Mozilla/5.0 CriOS/138.0 Mobile/15E148 Safari/604.1",
      "Apple Computer, Inc.",
    )).toBe(false);
    expect(isSafariBrowser(
      "Mozilla/5.0 Chrome/138.0 Safari/537.36",
      "Google Inc.",
    )).toBe(false);
  });

  it("replaces Safari fillText maxWidth compression with an explicit scale", () => {
    expect(glyphHorizontalScale(45, 29)).toBeCloseTo(29 / 45);
    expect(glyphHorizontalScale(20, 29)).toBe(1);
  });
});
