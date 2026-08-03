import * as THREE from "three";
import {describe, expect, it} from "vitest";
import {
  arcaneMagicPulse,
  createArcaneBookMagic,
  resolveBookMagicQuality,
} from "./book-magic-effect";

describe("book magic quality", () => {
  it("uses reduced effects when reduced motion is requested", () => {
    expect(resolveBookMagicQuality({
      reducedMotion: true,
      hardwareConcurrency: 12,
    })).toBe("reduced");
  });

  it("uses reduced effects on low-concurrency devices", () => {
    expect(resolveBookMagicQuality({
      reducedMotion: false,
      hardwareConcurrency: 4,
    })).toBe("reduced");
  });

  it("keeps the full preset on capable devices", () => {
    expect(resolveBookMagicQuality({
      reducedMotion: false,
      hardwareConcurrency: 8,
    })).toBe("full");
  });
});

describe("arcane magic pulse", () => {
  it("stays static when reduced motion is enabled", () => {
    expect(arcaneMagicPulse(0, true)).toBe(0.72);
    expect(arcaneMagicPulse(10_000, true)).toBe(0.72);
  });

  it("stays inside its bounded light range", () => {
    for (const now of [0, 250, 1_000, 10_000]) {
      expect(arcaneMagicPulse(now)).toBeGreaterThanOrEqual(0.6);
      expect(arcaneMagicPulse(now)).toBeLessThanOrEqual(0.84);
    }
  });
});

describe("cinematic book magic composition", () => {
  it("mounts only independent sparks for the restrained review variant", () => {
    const runtime = createArcaneBookMagic({
      reducedMotion: false,
      hardwareConcurrency: 8,
    });
    const names = runtime.group.children.map((child) => child.name);
    expect(names).toContain("BOOK_MAGIC_CINEMATIC_SPARKS");
    expect(names).not.toContain("BOOK_MAGIC_CONTINUOUS_VIOLET_AURA");
    expect(names).not.toContain("BOOK_MAGIC_AURA_LIGHT");
    expect(names.some((name) => name.includes("SIGIL"))).toBe(false);
    expect(names.some((name) => name.includes("FLAME"))).toBe(false);
    expect(runtime.setSparkIntensity).toBeTypeOf("function");
    runtime.dispose();
  });

  it("aligns the sparks to the actual local center of an offset book root", () => {
    const runtime = createArcaneBookMagic({
      reducedMotion: false,
      hardwareConcurrency: 8,
    });
    const root = new THREE.Group();
    const offsetBook = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.4));
    offsetBook.position.set(1, -0.5, 0.2);
    root.add(offsetBook);

    runtime.attachTo(root);

    expect(runtime.group.position.x).toBeCloseTo(1);
    expect(runtime.group.position.y).toBeCloseTo(-0.5);
    expect(runtime.group.position.z).toBeCloseTo(0.2);
    runtime.dispose();
    offsetBook.geometry.dispose();
  });

  it("reduces spark density for low-motion devices", () => {
    const runtime = createArcaneBookMagic({
      reducedMotion: true,
      hardwareConcurrency: 8,
    });
    const sparks = runtime.group.getObjectByName("BOOK_MAGIC_CINEMATIC_SPARKS");
    expect(sparks).toBeInstanceOf(THREE.Points);
    const position = (sparks as THREE.Points).geometry.getAttribute("position");
    expect(position.count).toBe(30);
    runtime.dispose();
  });
});
