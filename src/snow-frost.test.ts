import {describe, expect, it} from "vitest";
import * as THREE from "three";
import {createSnowFrost, resolveSnowFrostQuality} from "./snow-frost";

describe("snow frost runtime", () => {
  it("reduces the shader field for reduced motion and low-concurrency devices", () => {
    expect(resolveSnowFrostQuality(true, 12)).toBe("reduced");
    expect(resolveSnowFrostQuality(false, 4)).toBe("reduced");
    expect(resolveSnowFrostQuality(false, 8)).toBe("full");
  });

  it("mounts a reversible overlay and releases it from the typewriter root", () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.8)));
    const runtime = createSnowFrost(root, true);

    expect(root.children).toContain(runtime.group);
    runtime.setProgress(0);
    runtime.update(0);
    expect(runtime.group.visible).toBe(false);
    runtime.setProgress(1);
    runtime.update(1_000);
    expect(runtime.group.visible).toBe(true);
    expect(runtime.group.children).toHaveLength(1);
    expect(runtime.group.children[0]).toBeInstanceOf(THREE.Points);
    expect(runtime.group.children.some((child) => child instanceof THREE.Mesh)).toBe(false);

    runtime.dispose();
    expect(root.children).not.toContain(runtime.group);
  });
});
