import {describe, expect, it} from "vitest";
import {
  calibratedExposure,
  DISPLAY_EXPOSURE_MULTIPLIER,
  resolveDisplayPlatform,
} from "../src/display-profile";

describe("cross-platform display profile", () => {
  it("detects common Windows platform descriptions", () => {
    expect(resolveDisplayPlatform("Windows")).toBe("windows");
    expect(resolveDisplayPlatform("Win32 Chrome")).toBe("windows");
    expect(resolveDisplayPlatform("Win64")).toBe("windows");
  });

  it("uses the standard profile for macOS and other platforms", () => {
    expect(resolveDisplayPlatform("MacIntel macOS")).toBe("standard");
    expect(resolveDisplayPlatform("Linux x86_64")).toBe("standard");
  });

  it("raises every base exposure and gives Windows the stronger correction", () => {
    const baseExposure = 1;
    const standardExposure = calibratedExposure(baseExposure, "standard");
    const windowsExposure = calibratedExposure(baseExposure, "windows");
    expect(standardExposure).toBeCloseTo(DISPLAY_EXPOSURE_MULTIPLIER.standard);
    expect(windowsExposure).toBeCloseTo(DISPLAY_EXPOSURE_MULTIPLIER.windows);
    expect(standardExposure).toBeGreaterThan(baseExposure);
    expect(windowsExposure).toBeGreaterThan(standardExposure);
  });
});
