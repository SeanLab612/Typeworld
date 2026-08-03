import {describe, expect, it} from "vitest";

import {
  formatDiscoveredWords,
  formatKeywordArchiveSummary,
} from "./award-copy";

describe("award-ready public copy", () => {
  it("reports only completed discoveries instead of an unfinished target ratio", () => {
    expect(formatDiscoveredWords(0)).toBe("0 WORDS DISCOVERED");
    expect(formatDiscoveredWords(1)).toBe("1 WORD DISCOVERED");
    expect(formatDiscoveredWords(8)).toBe("8 WORDS DISCOVERED");
  });

  it("describes keyword archive contents without exposing the future capacity", () => {
    expect(formatKeywordArchiveSummary(8, false)).toBe("8 张首印");
    expect(formatKeywordArchiveSummary(50, true)).toBe("视觉已满 · 50 张首印");
  });

  it("normalizes invalid counters", () => {
    expect(formatDiscoveredWords(Number.NaN)).toBe("0 WORDS DISCOVERED");
    expect(formatKeywordArchiveSummary(-4, false)).toBe("0 张首印");
  });
});
