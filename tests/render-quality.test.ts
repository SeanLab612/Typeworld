import {describe, expect, it} from "vitest";
import {resolveRenderPixelRatio, resolveShadowMapSize} from "../src/render-quality";

describe("render quality", () => {
  it("keeps standard desktop displays sharp within the award fill-rate budget", () => {
    expect(resolveRenderPixelRatio({
      devicePixelRatio: 2,
      viewportWidth: 1440,
      hardwareConcurrency: 10,
      reducedMotion: false,
    })).toBe(1.5);
  });

  it("uses the compact cap on phones and lower-power devices", () => {
    expect(resolveRenderPixelRatio({
      devicePixelRatio: 3,
      viewportWidth: 390,
      hardwareConcurrency: 8,
      reducedMotion: false,
    })).toBe(1.35);
    expect(resolveRenderPixelRatio({
      devicePixelRatio: 2,
      viewportWidth: 1366,
      hardwareConcurrency: 4,
      reducedMotion: false,
    })).toBe(1.35);
  });

  it("never upscales a one-to-one display", () => {
    expect(resolveRenderPixelRatio({
      devicePixelRatio: 1,
      viewportWidth: 1920,
      hardwareConcurrency: 16,
      reducedMotion: false,
    })).toBe(1);
  });

  it("uses smaller shadows on compact and lower-power devices", () => {
    expect(resolveShadowMapSize(390, 8)).toBe(1024);
    expect(resolveShadowMapSize(1440, 4)).toBe(1024);
    expect(resolveShadowMapSize(1440, 10)).toBe(2048);
  });
});
