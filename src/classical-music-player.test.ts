import {describe, expect, it} from "vitest";
import {
  formatMusicTime,
  parseMusicPlayerPreferences,
  wrapTrackIndex,
} from "./classical-music-player";

describe("classical music player helpers", () => {
  it("wraps playlist indexes in both directions", () => {
    expect(wrapTrackIndex(3, 3)).toBe(0);
    expect(wrapTrackIndex(-1, 3)).toBe(2);
  });

  it("parses and clamps saved preferences", () => {
    expect(parseMusicPlayerPreferences('{"trackIndex":5,"volume":1.4}', 3)).toEqual({
      trackIndex: 2,
      volume: 1,
    });
    expect(parseMusicPlayerPreferences("not-json", 3)).toEqual({
      trackIndex: 0,
      volume: 0.34,
    });
  });

  it("formats player time without leaking invalid values", () => {
    expect(formatMusicTime(0)).toBe("0:00");
    expect(formatMusicTime(276.6)).toBe("4:36");
    expect(formatMusicTime(Number.NaN)).toBe("0:00");
  });
});
