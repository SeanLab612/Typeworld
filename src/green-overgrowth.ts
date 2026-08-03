import * as THREE from "three";

const VINE_RADIAL_SEGMENTS = 7;
const VINE_TUBULAR_SEGMENTS = 56;
const LEAF_COLOR = new THREE.Color();
const LEAF_COLOR_URL = new URL(
  "../assets/textures/green/leafset029/color.jpg",
  import.meta.url,
).href;
const LEAF_NORMAL_URL = new URL(
  "../assets/textures/green/leafset029/normal-gl.jpg",
  import.meta.url,
).href;
const LEAF_ROUGHNESS_URL = new URL(
  "../assets/textures/green/leafset029/roughness.jpg",
  import.meta.url,
).href;
const LEAF_OPACITY_URL = new URL(
  "../assets/textures/green/leafset029/opacity.jpg",
  import.meta.url,
).href;
const BARK_COLOR_URL = new URL(
  "../assets/textures/green/bark014/color.jpg",
  import.meta.url,
).href;
const BARK_NORMAL_URL = new URL(
  "../assets/textures/green/bark014/normal-gl.jpg",
  import.meta.url,
).href;
const BARK_ROUGHNESS_URL = new URL(
  "../assets/textures/green/bark014/roughness.jpg",
  import.meta.url,
).href;

export interface GreenOvergrowthRuntime {
  readonly group: THREE.Group;
  setProgress(progress: number): void;
  update(now: number): void;
  dispose(): void;
}

interface VineDefinition {
  readonly points: ReadonlyArray<readonly [number, number, number]>;
  readonly radius: number;
  readonly leafCount: number;
  readonly leafScale: number;
  readonly delay: number;
}

interface VineBinding {
  readonly mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  readonly indexCount: number;
  readonly delay: number;
}

interface LeafBinding {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly threshold: number;
  readonly restScale: THREE.Vector3;
  readonly phase: number;
}

interface OvergrowthTextures {
  readonly leafColor: THREE.Texture;
  readonly leafNormal: THREE.Texture;
  readonly leafRoughness: THREE.Texture;
  readonly leafOpacity: THREE.Texture;
  readonly barkColor: THREE.Texture;
  readonly barkNormal: THREE.Texture;
  readonly barkRoughness: THREE.Texture;
}

export function clampGrowthProgress(progress: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
}

export function smoothGrowthProgress(progress: number): number {
  const value = clampGrowthProgress(progress);
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

function createLeafGeometry(variant: number): THREE.BufferGeometry {
  const column = variant % 3;
  const rowFromTop = Math.floor(variant / 3);
  const uMin = column / 3;
  const uMax = (column + 1) / 3;
  const vMin = (2 - rowFromTop) / 3;
  const vMax = (3 - rowFromTop) / 3;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.5, 0, 0,
        0.5, 0, 0,
        -0.54, 0.5, 0,
        0, 0.5, 0.11,
        0.54, 0.5, 0,
        -0.46, 1, 0,
        0.46, 1, 0,
      ],
      3,
    ),
  );
  geometry.setIndex([
    0, 1, 3,
    0, 3, 2,
    2, 3, 5,
    3, 6, 5,
    3, 4, 6,
    3, 1, 4,
  ]);
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [
        uMin, vMin,
        uMax, vMin,
        uMin, (vMin + vMax) * 0.5,
        (uMin + uMax) * 0.5, (vMin + vMax) * 0.5,
        uMax, (vMin + vMax) * 0.5,
        uMin, vMax,
        uMax, vMax,
      ],
      2,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createVineDefinitions(): ReadonlyArray<VineDefinition> {
  return [
    {
      points: [
        [0.05, 0.06, 0.88],
        [0.035, 0.18, 0.82],
        [0.065, 0.33, 0.74],
        [0.045, 0.48, 0.62],
        [0.09, 0.64, 0.48],
      ],
      radius: 0.010,
      leafCount: 16,
      leafScale: 1.08,
      delay: 0,
    },
    {
      points: [
        [0.95, 0.07, 0.88],
        [0.965, 0.21, 0.80],
        [0.93, 0.36, 0.70],
        [0.955, 0.52, 0.57],
        [0.91, 0.66, 0.45],
      ],
      radius: 0.0095,
      leafCount: 16,
      leafScale: 1.04,
      delay: 0.07,
    },
    {
      points: [
        [0.08, 0.08, 0.94],
        [0.23, 0.10, 0.965],
        [0.39, 0.085, 0.975],
        [0.56, 0.11, 0.97],
        [0.74, 0.09, 0.96],
        [0.91, 0.12, 0.93],
      ],
      radius: 0.008,
      leafCount: 22,
      leafScale: 0.92,
      delay: 0.13,
    },
    {
      points: [
        [0.04, 0.30, 0.70],
        [0.025, 0.39, 0.57],
        [0.055, 0.49, 0.43],
        [0.035, 0.60, 0.31],
      ],
      radius: 0.005,
      leafCount: 11,
      leafScale: 0.72,
      delay: 0.28,
    },
    {
      points: [
        [0.96, 0.31, 0.69],
        [0.975, 0.40, 0.56],
        [0.945, 0.50, 0.42],
        [0.965, 0.61, 0.30],
      ],
      radius: 0.005,
      leafCount: 11,
      leafScale: 0.72,
      delay: 0.34,
    },
    {
      points: [
        [0.10, 0.07, 0.95],
        [0.13, 0.19, 0.88],
        [0.11, 0.31, 0.78],
        [0.15, 0.43, 0.67],
        [0.12, 0.56, 0.54],
      ],
      radius: 0.0065,
      leafCount: 15,
      leafScale: 0.86,
      delay: 0.17,
    },
    {
      points: [
        [0.90, 0.07, 0.95],
        [0.87, 0.19, 0.88],
        [0.89, 0.31, 0.78],
        [0.85, 0.43, 0.67],
        [0.88, 0.56, 0.54],
      ],
      radius: 0.0065,
      leafCount: 15,
      leafScale: 0.86,
      delay: 0.22,
    },
    {
      points: [
        [0.10, 0.16, 0.91],
        [0.28, 0.18, 0.93],
        [0.47, 0.15, 0.94],
        [0.66, 0.18, 0.93],
        [0.89, 0.16, 0.90],
      ],
      radius: 0.006,
      leafCount: 20,
      leafScale: 0.78,
      delay: 0.25,
    },
    {
      points: [
        [0.055, 0.42, 0.58],
        [0.09, 0.53, 0.52],
        [0.065, 0.64, 0.43],
        [0.12, 0.73, 0.35],
      ],
      radius: 0.0045,
      leafCount: 9,
      leafScale: 0.66,
      delay: 0.42,
    },
    {
      points: [
        [0.945, 0.42, 0.58],
        [0.91, 0.53, 0.52],
        [0.935, 0.64, 0.43],
        [0.88, 0.73, 0.35],
      ],
      radius: 0.0045,
      leafCount: 9,
      leafScale: 0.66,
      delay: 0.47,
    },
    {
      points: [
        [0.045, 0.22, 0.78],
        [0.10, 0.33, 0.70],
        [0.17, 0.43, 0.61],
        [0.25, 0.52, 0.52],
        [0.30, 0.60, 0.45],
      ],
      radius: 0.0055,
      leafCount: 15,
      leafScale: 0.78,
      delay: 0.36,
    },
    {
      points: [
        [0.955, 0.22, 0.78],
        [0.90, 0.33, 0.70],
        [0.83, 0.43, 0.61],
        [0.75, 0.52, 0.52],
        [0.70, 0.60, 0.45],
      ],
      radius: 0.0055,
      leafCount: 15,
      leafScale: 0.78,
      delay: 0.40,
    },
  ];
}

function createLeaf(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
  curve: THREE.CatmullRomCurve3,
  t: number,
  side: number,
  boxSize: THREE.Vector3,
  scale: number,
  threshold: number,
  index: number,
): LeafBinding {
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `GREEN_LEAF_${String(index + 1).padStart(3, "0")}`;
  mesh.position.copy(point);

  const outward = new THREE.Vector3(side, 0.52 + (index % 3) * 0.12, 0.42).normalize();
  const leafDirection = tangent.clone().multiplyScalar(0.24).add(outward).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), leafDirection);
  mesh.rotateY(side * (0.38 + (index % 4) * 0.11));
  mesh.rotateX(-0.22 + (index % 3) * 0.12);
  const leafSize = Math.min(boxSize.x, boxSize.z) * 0.136 * scale;
  const restScale = new THREE.Vector3(leafSize * 0.62, leafSize, leafSize);
  mesh.scale.setScalar(0.0001);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  return {
    mesh,
    threshold,
    restScale,
    phase: index * 0.77,
  };
}

export function createGreenOvergrowth(
  typewriterRoot: THREE.Object3D,
  textures: OvergrowthTextures,
): GreenOvergrowthRuntime {
  typewriterRoot.updateWorldMatrix(true, true);
  const worldBox = new THREE.Box3().setFromObject(typewriterRoot);
  const inverseWorld = typewriterRoot.matrixWorld.clone().invert();
  const localBox = worldBox.clone().applyMatrix4(inverseWorld);
  const boxSize = localBox.getSize(new THREE.Vector3());

  const group = new THREE.Group();
  group.name = "GREEN_OVERGROWTH_ROOT";
  group.visible = false;
  typewriterRoot.add(group);

  const vineMaterial = new THREE.MeshStandardMaterial({
    color: 0x4d5f31,
    map: textures.barkColor,
    normalMap: textures.barkNormal,
    roughnessMap: textures.barkRoughness,
    roughness: 0.88,
    metalness: 0,
  });
  const tendrilMaterial = vineMaterial.clone();
  tendrilMaterial.color.setHex(0x667643);
  const leafMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x91a878,
      map: textures.leafColor,
      normalMap: textures.leafNormal,
      roughnessMap: textures.leafRoughness,
      alphaMap: textures.leafOpacity,
      alphaTest: 0.34,
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x718b59,
      map: textures.leafColor,
      normalMap: textures.leafNormal,
      roughnessMap: textures.leafRoughness,
      alphaMap: textures.leafOpacity,
      alphaTest: 0.34,
      roughness: 0.90,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xa4a86d,
      map: textures.leafColor,
      normalMap: textures.leafNormal,
      roughnessMap: textures.leafRoughness,
      alphaMap: textures.leafOpacity,
      alphaTest: 0.34,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  ];
  for (const material of leafMaterials) {
    material.normalScale.set(0.72, 0.72);
  }
  const leafGeometries = Array.from({length: 9}, (_, index) => createLeafGeometry(index));
  const vineBindings: VineBinding[] = [];
  const leafBindings: LeafBinding[] = [];
  let leafIndex = 0;

  for (const [vineIndex, definition] of createVineDefinitions().entries()) {
    const curve = new THREE.CatmullRomCurve3(
      definition.points.map((point) => normalizedPoint(localBox, point)),
      false,
      "centripetal",
      0.45,
    );
    const radius = Math.min(boxSize.x, boxSize.z) * definition.radius;
    const geometry = new THREE.TubeGeometry(
      curve,
      VINE_TUBULAR_SEGMENTS,
      radius,
      VINE_RADIAL_SEGMENTS,
      false,
    );
    const material = definition.radius < 0.007 ? tendrilMaterial : vineMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `GREEN_VINE_${String(vineIndex + 1).padStart(2, "0")}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    geometry.setDrawRange(0, 0);
    group.add(mesh);
    vineBindings.push({
      mesh,
      indexCount: geometry.index?.count ?? 0,
      delay: definition.delay,
    });

    for (let index = 0; index < definition.leafCount; index += 1) {
      const t = (index + 1) / (definition.leafCount + 1);
      const side = (index + vineIndex) % 2 === 0 ? -1 : 1;
      const threshold = definition.delay + t * (0.72 - definition.delay);
      const leaf = createLeaf(
        leafGeometries[leafIndex % leafGeometries.length]!,
        leafMaterials[leafIndex % leafMaterials.length]!,
        curve,
        t,
        side,
        boxSize,
        definition.leafScale * (0.86 + (leafIndex % 5) * 0.045),
        threshold,
        leafIndex,
      );
      LEAF_COLOR.setHSL(0.24 + (leafIndex % 4) * 0.012, 0.30, 0.25);
      leaf.mesh.userData.greenTint = LEAF_COLOR.getHex();
      group.add(leaf.mesh);
      leafBindings.push(leaf);
      leafIndex += 1;
    }
  }

  let progress = 0;

  function setProgress(nextProgress: number): void {
    progress = smoothGrowthProgress(nextProgress);
    group.visible = progress > 0.001;
    for (const binding of vineBindings) {
      const localProgress = clampGrowthProgress(
        (progress - binding.delay) / Math.max(0.001, 1 - binding.delay),
      );
      binding.mesh.geometry.setDrawRange(
        0,
        Math.floor(binding.indexCount * localProgress / 3) * 3,
      );
    }
    for (const binding of leafBindings) {
      const localProgress = smoothGrowthProgress(
        (progress - binding.threshold) / 0.18,
      );
      binding.mesh.scale.copy(binding.restScale).multiplyScalar(localProgress);
    }
  }

  return {
    group,
    setProgress,
    update(now: number) {
      if (!group.visible) return;
      const breeze = now * 0.0007;
      for (const [index, binding] of leafBindings.entries()) {
        if (binding.mesh.scale.x <= 0.0002) continue;
        binding.mesh.rotation.z = Math.sin(breeze + binding.phase) * 0.025;
        binding.mesh.rotation.x += Math.sin(breeze * 0.72 + index) * 0.00008;
      }
    },
    dispose() {
      group.removeFromParent();
      for (const binding of vineBindings) binding.mesh.geometry.dispose();
      for (const geometry of leafGeometries) geometry.dispose();
      vineMaterial.dispose();
      tendrilMaterial.dispose();
      for (const material of leafMaterials) material.dispose();
      for (const texture of Object.values(textures)) texture.dispose();
    },
  };
}

export async function loadGreenOvergrowth(
  typewriterRoot: THREE.Object3D,
): Promise<GreenOvergrowthRuntime> {
  const loader = new THREE.TextureLoader();
  const [
    leafColor,
    leafNormal,
    leafRoughness,
    leafOpacity,
    barkColor,
    barkNormal,
    barkRoughness,
  ] = await Promise.all([
    loader.loadAsync(LEAF_COLOR_URL),
    loader.loadAsync(LEAF_NORMAL_URL),
    loader.loadAsync(LEAF_ROUGHNESS_URL),
    loader.loadAsync(LEAF_OPACITY_URL),
    loader.loadAsync(BARK_COLOR_URL),
    loader.loadAsync(BARK_NORMAL_URL),
    loader.loadAsync(BARK_ROUGHNESS_URL),
  ]);
  leafColor.colorSpace = THREE.SRGBColorSpace;
  barkColor.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [barkColor, barkNormal, barkRoughness]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
  }
  return createGreenOvergrowth(typewriterRoot, {
    leafColor,
    leafNormal,
    leafRoughness,
    leafOpacity,
    barkColor,
    barkNormal,
    barkRoughness,
  });
}
