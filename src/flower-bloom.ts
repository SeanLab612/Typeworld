import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

const FLOWER_MODEL_URL = "/models/vendor/poly-haven-flower-ursinia/flower_ursinia_1k.gltf";
const FLOWER_ALPHA_URL = "/models/vendor/poly-haven-flower-ursinia/textures/flower_ursinia_alpha_1k.png";
const FULL_PETAL_COUNT = 42;
const REDUCED_PETAL_COUNT = 0;

export interface FlowerBloomRuntime {
  readonly group: THREE.Group;
  setProgress(progress: number): void;
  update(now: number): void;
  dispose(): void;
}

export type FlowerBloomQuality = "full" | "reduced";

interface FlowerPlacement {
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly rotationY: number;
  readonly tilt: number;
  readonly delay: number;
}

interface FlowerBinding {
  readonly root: THREE.Object3D;
  readonly restScale: THREE.Vector3;
  readonly restY: number;
  readonly restRotationZ: number;
  readonly delay: number;
  readonly phase: number;
}

export const FLOWER_PLACEMENTS: ReadonlyArray<FlowerPlacement> = [
  {position: [0.035, 0.065, 0.93], scale: 0.98, rotationY: 0.24, tilt: -0.08, delay: 0},
  {position: [0.11, 0.075, 0.965], scale: 0.78, rotationY: -0.42, tilt: 0.05, delay: 0.08},
  {position: [0.21, 0.055, 0.955], scale: 0.62, rotationY: 0.70, tilt: -0.04, delay: 0.17},
  {position: [0.965, 0.065, 0.93], scale: 0.94, rotationY: -0.26, tilt: 0.08, delay: 0.04},
  {position: [0.89, 0.075, 0.965], scale: 0.76, rotationY: 0.48, tilt: -0.05, delay: 0.12},
  {position: [0.79, 0.055, 0.955], scale: 0.60, rotationY: -0.66, tilt: 0.04, delay: 0.22},
  {position: [0.025, 0.24, 0.74], scale: 0.72, rotationY: 0.86, tilt: -0.14, delay: 0.28},
  {position: [0.975, 0.25, 0.74], scale: 0.70, rotationY: -0.82, tilt: 0.14, delay: 0.32},
  {position: [0.055, 0.39, 0.57], scale: 0.56, rotationY: 1.08, tilt: -0.18, delay: 0.42},
  {position: [0.945, 0.40, 0.57], scale: 0.54, rotationY: -1.04, tilt: 0.18, delay: 0.46},
  {position: [0.14, 0.15, 0.84], scale: 0.50, rotationY: 0.34, tilt: -0.07, delay: 0.36},
  {position: [0.86, 0.16, 0.84], scale: 0.48, rotationY: -0.38, tilt: 0.07, delay: 0.40},
];

export function clampFlowerProgress(progress: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
}

export function resolveFlowerBloomQuality(
  reducedMotion: boolean,
  hardwareConcurrency = globalThis.navigator?.hardwareConcurrency,
): FlowerBloomQuality {
  if (reducedMotion) return "reduced";
  if (typeof hardwareConcurrency === "number" && hardwareConcurrency <= 4) {
    return "reduced";
  }
  return "full";
}

function smoothBloom(progress: number): number {
  const value = clampFlowerProgress(progress);
  return value * value * (3 - 2 * value);
}

function normalizedPoint(
  box: THREE.Box3,
  point: readonly [number, number, number],
): THREE.Vector3 {
  return new THREE.Vector3(
    THREE.MathUtils.lerp(box.min.x, box.max.x, point[0]),
    THREE.MathUtils.lerp(box.min.y, box.max.y, point[1]),
    THREE.MathUtils.lerp(box.min.z, box.max.z, point[2]),
  );
}

function seeded(index: number, channel: number): number {
  const value = Math.sin(index * 91.17 + channel * 313.91) * 43_758.5453;
  return value - Math.floor(value);
}

function createPetalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uProgress: {value: 0},
      uTime: {value: 0},
      uPixelRatio: {value: Math.min(globalThis.devicePixelRatio ?? 1, 2)},
      uMinY: {value: 0},
      uMaxY: {value: 1},
      uSpanX: {value: 1},
    },
    vertexShader: `
      precision highp float;
      uniform float uProgress;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uMinY;
      uniform float uMaxY;
      uniform float uSpanX;
      attribute float aSeed;
      attribute float aSize;
      varying float vSeed;
      varying float vFade;

      void main() {
        float cycle = fract(aSeed + uTime * (0.025 + aSeed * 0.026));
        vec3 animated = position;
        animated.y = mix(uMaxY * 0.82, uMinY + (uMaxY - uMinY) * 0.08, cycle);
        animated.x += sin(uTime * 0.58 + aSeed * 37.0) * uSpanX * 0.022;
        animated.z += cos(uTime * 0.41 + aSeed * 29.0) * uSpanX * 0.015;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aSize * uPixelRatio * 2.0 / max(0.68, -viewPosition.z);
        vSeed = aSeed;
        vFade = smoothstep(0.0, 0.14, cycle) * (1.0 - smoothstep(0.80, 1.0, cycle));
        vFade *= uProgress;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vSeed;
      varying float vFade;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float angle = vSeed * 6.2831853;
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        point = rotation * point;
        float petal = length(vec2(point.x * 2.7, point.y * 1.12));
        float alpha = (1.0 - smoothstep(0.30, 0.49, petal)) * vFade * 0.70;
        if (alpha < 0.012) discard;
        vec3 paleGold = mix(vec3(0.96, 0.72, 0.20), vec3(1.0, 0.91, 0.55), vSeed);
        gl_FragColor = vec4(paleGold, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

function createPetals(
  box: THREE.Box3,
  quality: FlowerBloomQuality,
): {points: THREE.Points; geometry: THREE.BufferGeometry; material: THREE.ShaderMaterial} {
  const count = quality === "reduced" ? REDUCED_PETAL_COUNT : FULL_PETAL_COUNT;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const point = normalizedPoint(box, [
      -0.06 + seeded(index, 1) * 1.12,
      seeded(index, 2),
      0.52 + seeded(index, 3) * 0.52,
    ]);
    const offset = index * 3;
    positions[offset] = point.x;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z;
    seeds[index] = seeded(index, 4);
    sizes[index] = 2.3 + seeded(index, 5) * 3.8;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  const material = createPetalMaterial();
  const points = new THREE.Points(geometry, material);
  points.name = "FLOWER_DRIFTING_PETALS";
  points.renderOrder = 8;
  points.frustumCulled = false;
  return {points, geometry, material};
}

export async function loadFlowerBloom(
  typewriterRoot: THREE.Object3D,
  reducedMotion = false,
): Promise<FlowerBloomRuntime> {
  const quality = resolveFlowerBloomQuality(reducedMotion);
  const [gltf, alphaMap] = await Promise.all([
    new GLTFLoader().loadAsync(FLOWER_MODEL_URL),
    new THREE.TextureLoader().loadAsync(FLOWER_ALPHA_URL),
  ]);
  alphaMap.flipY = false;
  alphaMap.colorSpace = THREE.NoColorSpace;
  alphaMap.needsUpdate = true;

  const allVariants = gltf.scene.children.filter((child) => (
    child.name.startsWith("flower_ursinia_")
  ));
  const variants = allVariants.slice(2);
  if (variants.length === 0) throw new Error("Flower Ursinia variants are unavailable");

  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedTextures = new Set<THREE.Texture>([alphaMap]);
  for (const variant of variants) {
    variant.position.set(0, 0, 0);
    variant.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      ownedGeometries.add(object.geometry);
      const sourceMaterial = object.material;
      if (!(sourceMaterial instanceof THREE.MeshStandardMaterial)) return;
      const material = sourceMaterial.clone();
      material.alphaMap = alphaMap;
      material.alphaTest = 0.34;
      material.transparent = false;
      material.side = THREE.DoubleSide;
      material.roughness = Math.max(material.roughness, 0.72);
      material.envMapIntensity = 0.58;
      object.material = material;
      ownedMaterials.add(material);
      for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
        if (texture) ownedTextures.add(texture);
      }
    });
  }

  typewriterRoot.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(typewriterRoot);
  const localBox = worldBox.clone().applyMatrix4(typewriterRoot.matrixWorld.clone().invert());
  const size = localBox.getSize(new THREE.Vector3());
  const sourceHeight = 0.148;
  const baseScale = Math.max(size.x * 0.11 / sourceHeight, 0.28);

  const group = new THREE.Group();
  group.name = "FX_FLOWER_BLOOM";
  group.visible = false;
  const bindings: FlowerBinding[] = [];
  for (let index = 0; index < FLOWER_PLACEMENTS.length; index += 1) {
    const placement = FLOWER_PLACEMENTS[index];
    if (!placement) continue;
    const source = variants[index % variants.length];
    if (!source) continue;
    const root = source.clone(true);
    const position = normalizedPoint(localBox, placement.position);
    root.position.copy(position);
    root.rotation.set(0, placement.rotationY, placement.tilt);
    const scale = baseScale * placement.scale;
    root.scale.setScalar(scale);
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
    group.add(root);
    bindings.push({
      root,
      restScale: root.scale.clone(),
      restY: root.position.y,
      restRotationZ: root.rotation.z,
      delay: placement.delay,
      phase: seeded(index, 12) * Math.PI * 2,
    });
  }

  const petals = createPetals(localBox, quality);
  group.add(petals.points);
  typewriterRoot.add(group);

  const progressUniform = petals.material.uniforms.uProgress;
  const timeUniform = petals.material.uniforms.uTime;
  const minYUniform = petals.material.uniforms.uMinY;
  const maxYUniform = petals.material.uniforms.uMaxY;
  const spanXUniform = petals.material.uniforms.uSpanX;
  if (!progressUniform || !timeUniform || !minYUniform || !maxYUniform || !spanXUniform) {
    throw new Error("Flower petal shader uniforms are unavailable");
  }
  minYUniform.value = localBox.min.y;
  maxYUniform.value = localBox.max.y;
  spanXUniform.value = Math.max(size.x, 0.1);

  let targetProgress = 0;
  let visibleProgress = 0;
  return {
    group,
    setProgress(progress): void {
      targetProgress = clampFlowerProgress(progress);
    },
    update(now): void {
      visibleProgress = THREE.MathUtils.lerp(
        visibleProgress,
        targetProgress,
        quality === "reduced" ? 0.24 : 0.105,
      );
      group.visible = visibleProgress > 0.003;
      const seconds = now * 0.001;
      for (const binding of bindings) {
        const localProgress = smoothBloom(
          (visibleProgress - binding.delay) / Math.max(0.001, 1 - binding.delay),
        );
        binding.root.scale.copy(binding.restScale).multiplyScalar(localProgress);
        binding.root.position.y = binding.restY - (1 - localProgress) * size.y * 0.016;
        binding.root.rotation.z = binding.restRotationZ
          + (quality === "full" ? Math.sin(seconds * 0.48 + binding.phase) * 0.012 : 0);
      }
      progressUniform.value = smoothBloom((visibleProgress - 0.48) / 0.52);
      timeUniform.value = seconds;
    },
    dispose(): void {
      typewriterRoot.remove(group);
      petals.geometry.dispose();
      petals.material.dispose();
      for (const geometry of ownedGeometries) geometry.dispose();
      for (const material of ownedMaterials) material.dispose();
      for (const texture of ownedTextures) texture.dispose();
    },
  };
}
