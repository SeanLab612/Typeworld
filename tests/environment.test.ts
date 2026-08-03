import {describe, expect, it} from "vitest";
import * as THREE from "three";

describe("3D environment", () => {
  it("provides the Three.js runtime required by the project", () => {
    expect(THREE.REVISION).toMatch(/^\d+$/);
    expect(new THREE.Group()).toBeInstanceOf(THREE.Object3D);
  });
});
