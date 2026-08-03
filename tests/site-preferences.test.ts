import {describe, expect, it} from "vitest";
import {parseSitePreferences} from "../src/site-preferences";

describe("shared site preferences", () => {
  it("uses stable defaults for missing or malformed storage", () => {
    expect(parseSitePreferences(null)).toEqual({soundEnabled: true, volume: 0.58});
    expect(parseSitePreferences("{broken")).toEqual({soundEnabled: true, volume: 0.58});
  });

  it("preserves mute and clamps volume", () => {
    expect(parseSitePreferences('{"soundEnabled":false,"volume":2}'))
      .toEqual({soundEnabled: false, volume: 1});
    expect(parseSitePreferences('{"soundEnabled":true,"volume":-1}'))
      .toEqual({soundEnabled: true, volume: 0});
  });
});
