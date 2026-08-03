import * as THREE from "three";
import {PROJECT_BOOK_DIMENSIONS} from "./project-book-spec";

export type BookMagicQuality = "full" | "reduced";

export interface BookMagicCapabilities {
  readonly reducedMotion: boolean;
  readonly hardwareConcurrency?: number;
}

export interface BookMagicRuntime {
  readonly group: THREE.Group;
  attachTo(bookRoot: THREE.Object3D): void;
  setIntensity(intensity: number): void;
  setSparkIntensity(intensity: number): void;
  update(now: number): void;
  dispose(): void;
}

interface ParticleField {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
  readonly positions: Float32Array;
  readonly origins: Float32Array;
  readonly phases: Float32Array;
  readonly speeds: Float32Array;
  readonly drifts: Float32Array;
}

export function resolveBookMagicQuality(
  capabilities: BookMagicCapabilities,
): BookMagicQuality {
  if (capabilities.reducedMotion) return "reduced";
  if (
    typeof capabilities.hardwareConcurrency === "number"
    && capabilities.hardwareConcurrency <= 4
  ) {
    return "reduced";
  }
  return "full";
}

export function arcaneMagicPulse(now: number, reducedMotion = false): number {
  if (reducedMotion) return 0.72;
  const slowBreath = Math.sin(now * 0.00117) * 0.065;
  const unsettledFlicker = Math.sin(now * 0.0049 + 1.7) * 0.028;
  return 0.73 + slowBreath + unsettledFlicker;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function seededValue(index: number, channel: number): number {
  return fract(Math.sin(index * 91.731 + channel * 47.137) * 43_758.5453);
}

function createParticleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: {value: 0},
      uPixelRatio: {value: Math.min(globalThis.devicePixelRatio ?? 1, 2)},
    },
    vertexShader: `
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aHeat;
      varying float vHeat;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aSize * uPixelRatio * (2.25 / max(0.8, -viewPosition.z));
        vHeat = aHeat;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uIntensity;
      varying float vHeat;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float radius = length(point);
        float core = 1.0 - smoothstep(0.025, 0.22, radius);
        float halo = 1.0 - smoothstep(0.08, 0.5, radius);
        float alpha = (core + halo * 0.33) * uIntensity;
        if (alpha < 0.01) discard;
        vec3 violet = vec3(0.42, 0.10, 0.92);
        vec3 hot = vec3(0.95, 0.74, 1.0);
        gl_FragColor = vec4(mix(violet, hot, vHeat) * (0.9 + core), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createParticleField(count: number): ParticleField {
  const positions = new Float32Array(count * 3);
  const origins = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const drifts = new Float32Array(count);
  const sizes = new Float32Array(count);
  const heat = new Float32Array(count);
  const halfWidth = PROJECT_BOOK_DIMENSIONS.width * 0.5;
  const halfHeight = PROJECT_BOOK_DIMENSIONS.height * 0.5;

  for (let index = 0; index < count; index += 1) {
    const side = index % 4;
    const edgePosition = seededValue(index, 1) * 2 - 1;
    let x = 0;
    let y = 0;
    if (side === 0) {
      x = halfWidth * (0.82 + seededValue(index, 2) * 0.3);
      y = edgePosition * halfHeight;
    } else if (side === 1) {
      x = edgePosition * halfWidth;
      y = halfHeight * (0.84 + seededValue(index, 3) * 0.28);
    } else if (side === 2) {
      x = -halfWidth * (0.82 + seededValue(index, 4) * 0.3);
      y = edgePosition * halfHeight;
    } else {
      x = edgePosition * halfWidth;
      y = -halfHeight * (0.84 + seededValue(index, 5) * 0.28);
    }
    origins[index * 3] = x;
    origins[index * 3 + 1] = y;
    origins[index * 3 + 2] = PROJECT_BOOK_DIMENSIONS.pageDepth
      * (1.05 + seededValue(index, 6));
    phases[index] = seededValue(index, 7);
    speeds[index] = 0.65 + seededValue(index, 8) * 0.9;
    drifts[index] = 0.04 + seededValue(index, 9) * 0.14;
    sizes[index] = 2.8 + seededValue(index, 10) * 5.8;
    heat[index] = seededValue(index, 11);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aHeat", new THREE.BufferAttribute(heat, 1));
  const material = createParticleMaterial();
  const points = new THREE.Points(geometry, material);
  points.name = "BOOK_MAGIC_CINEMATIC_SPARKS";
  points.renderOrder = 6;
  points.frustumCulled = false;
  return {points, geometry, material, positions, origins, phases, speeds, drifts};
}

export function createArcaneBookMagic(
  capabilities: BookMagicCapabilities,
): BookMagicRuntime {
  const quality = resolveBookMagicQuality(capabilities);
  const reducedMotion = quality === "reduced";
  const group = new THREE.Group();
  group.name = "BOOK_MAGIC_CINEMATIC_ROOT";
  group.visible = false;

  const particles = createParticleField(reducedMotion ? 30 : 78);
  group.add(particles.points);

  let targetIntensity = 0;
  let intensity = 0;
  let targetSparkMix = 1;
  let sparkMix = 1;

  function updateParticles(now: number): void {
    const elapsed = now * (reducedMotion ? 0.000035 : 0.00015);
    for (let index = 0; index < particles.phases.length; index += 1) {
      const cycle = fract(
        particles.phases[index]! + elapsed * particles.speeds[index]!,
      );
      const lift = cycle * (0.3 + seededValue(index, 12) * 0.62);
      const flutter = Math.sin(elapsed * 13 + index * 2.17)
        * particles.drifts[index]!;
      particles.positions[index * 3] = particles.origins[index * 3]! + flutter;
      particles.positions[index * 3 + 1] = particles.origins[index * 3 + 1]!
        + lift;
      particles.positions[index * 3 + 2] = particles.origins[index * 3 + 2]!
        + Math.cos(elapsed * 8 + index) * 0.045;
    }
    particles.geometry.attributes.position!.needsUpdate = true;
  }

  return {
    group,
    attachTo(bookRoot: THREE.Object3D) {
      group.removeFromParent();
      bookRoot.updateWorldMatrix(true, true);
      const worldCenter = new THREE.Box3()
        .setFromObject(bookRoot)
        .getCenter(new THREE.Vector3());
      const localCenter = bookRoot.worldToLocal(worldCenter);
      bookRoot.add(group);
      group.position.copy(localCenter);
      group.rotation.set(0, 0, 0);
    },
    setIntensity(nextIntensity: number) {
      targetIntensity = clamp01(nextIntensity);
    },
    setSparkIntensity(nextIntensity: number) {
      targetSparkMix = clamp01(nextIntensity);
    },
    update(now: number) {
      intensity = THREE.MathUtils.lerp(
        intensity,
        targetIntensity,
        reducedMotion ? 0.24 : 0.085,
      );
      sparkMix = THREE.MathUtils.lerp(
        sparkMix,
        targetSparkMix,
        reducedMotion ? 0.24 : 0.09,
      );
      const sparkIntensity = intensity * sparkMix;
      group.visible = sparkIntensity > 0.004;
      if (!group.visible) return;

      const pulse = arcaneMagicPulse(now, reducedMotion);
      particles.material.uniforms.uIntensity!.value = sparkIntensity
        * (0.48 + pulse * 0.52);
      updateParticles(now);
    },
    dispose() {
      group.removeFromParent();
      particles.geometry.dispose();
      particles.material.dispose();
    },
  };
}
