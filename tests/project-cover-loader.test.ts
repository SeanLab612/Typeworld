import {describe, expect, it} from "vitest";
import {createFallbackProjectCover} from "../src/project-cover-loader";

describe("project cover fallback", () => {
  it("creates a renderable one-pixel texture when artwork is unavailable", () => {
    const texture = createFallbackProjectCover(0x7c1b25);
    expect(texture.image.width).toBe(1);
    expect(texture.image.height).toBe(1);
    expect(texture.needsUpdate).toBeUndefined();
    expect(texture.version).toBeGreaterThan(0);
  });
});
