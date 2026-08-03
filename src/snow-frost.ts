import * as THREE from "three";

const FULL_GLINT_COUNT = 210;
const FULL_SNOW_COUNT = 120;
const REDUCED_GLINT_COUNT = 96;
const REDUCED_SNOW_COUNT = 0;

export interface SnowFrostRuntime {
  readonly group: THREE.Group;
  setProgress(progress: number): void;
  update(now: number): void;
  dispose(): void;
}

export type SnowFrostQuality = "full" | "reduced";

export function resolveSnowFrostQuality(
  reducedMotion: boolean,
  hardwareConcurrency = globalThis.navigator?.hardwareConcurrency,
): SnowFrostQuality {
  if (reducedMotion) return "reduced";
  if (
    typeof hardwareConcurrency === "number"
    && hardwareConcurrency <= 4
  ) {
    return "reduced";
  }
  return "full";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function seeded(index: number, channel: number): number {
  return fract(Math.sin(index * 127.1 + channel * 311.7) * 43_758.5453);
}

function localPoint(
  box: THREE.Box3,
  x: number,
  y: number,
  z: number,
): THREE.Vector3 {
  return new THREE.Vector3(
    THREE.MathUtils.lerp(box.min.x, box.max.x, x),
    THREE.MathUtils.lerp(box.min.y, box.max.y, y),
    THREE.MathUtils.lerp(box.min.z, box.max.z, z),
  );
}

function createFrostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: {value: 0},
      uTime: {value: 0},
      uPixelRatio: {value: Math.min(globalThis.devicePixelRatio ?? 1, 2)},
      uMinY: {value: 0},
      uMaxY: {value: 1},
      uSpanX: {value: 1},
    },
    vertexShader: `
      precision highp float;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uMinY;
      uniform float uMaxY;
      uniform float uSpanX;
      attribute float aSize;
      attribute float aSeed;
      attribute float aKind;
      attribute float aBrightness;
      varying float vKind;
      varying float vBrightness;
      varying float vPulse;

      float hash(float value) {
        return fract(sin(value * 91.731) * 43758.5453);
      }

      void main() {
        vec3 animated = position;
        float pulse = 0.70 + 0.30 * sin(
          uTime * (0.62 + aSeed * 0.74) + aSeed * 31.0
        );
        if (aKind > 0.5) {
          float speed = 0.035 + hash(aSeed + 4.0) * 0.045;
          float fall = fract(aSeed + uTime * speed);
          animated.y = mix(uMaxY, uMinY, fall);
          animated.x += sin(uTime * 0.55 + aSeed * 29.0)
            * uSpanX * (0.008 + hash(aSeed + 8.0) * 0.014);
          animated.z += cos(uTime * 0.43 + aSeed * 17.0) * uSpanX * 0.006;
          pulse = 0.78 + 0.22 * sin(uTime * 1.1 + aSeed * 19.0);
        }

        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        float perspective = 2.15 / max(0.65, -viewPosition.z);
        gl_PointSize = aSize * uPixelRatio * perspective;
        vKind = aKind;
        vBrightness = aBrightness;
        vPulse = pulse;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uIntensity;
      varying float vKind;
      varying float vBrightness;
      varying float vPulse;

      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float radius = length(point);
        float core = 1.0 - smoothstep(0.025, 0.17, radius);
        float halo = 1.0 - smoothstep(0.08, 0.5, radius);
        float glintShape = core + halo * 0.30;
        float snowShape = 1.0 - smoothstep(0.12, 0.48, radius);
        float shape = mix(glintShape, snowShape, vKind);
        float alpha = shape * uIntensity * vBrightness * vPulse;
        if (alpha < 0.012) discard;

        vec3 iceBlue = vec3(0.30, 0.69, 1.0);
        vec3 snowWhite = vec3(0.88, 0.96, 1.0);
        vec3 color = mix(iceBlue, snowWhite, 0.34 + vBrightness * 0.52);
        gl_FragColor = vec4(color * (0.82 + core * 0.78), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function frostAnchor(
  box: THREE.Box3,
  index: number,
): THREE.Vector3 {
  const lane = index % 6;
  const along = seeded(index, 1);
  if (lane === 0) {
    return localPoint(box, along, 0.89 + seeded(index, 2) * 0.08, 0.73);
  }
  if (lane === 1) {
    return localPoint(box, along, 0.48 + seeded(index, 3) * 0.25, 0.92);
  }
  if (lane === 2) {
    return localPoint(box, 0.04 + seeded(index, 4) * 0.08, along, 0.72 + seeded(index, 5) * 0.24);
  }
  if (lane === 3) {
    return localPoint(box, 0.88 + seeded(index, 4) * 0.08, along, 0.72 + seeded(index, 5) * 0.24);
  }
  if (lane === 4) {
    return localPoint(box, along, 0.10 + seeded(index, 6) * 0.13, 0.90 + seeded(index, 7) * 0.07);
  }
  return localPoint(
    box,
    0.14 + seeded(index, 8) * 0.72,
    0.28 + seeded(index, 9) * 0.42,
    0.84 + seeded(index, 10) * 0.13,
  );
}

export function createSnowFrost(
  typewriterRoot: THREE.Object3D,
  reducedMotion = false,
): SnowFrostRuntime {
  const quality = resolveSnowFrostQuality(reducedMotion);
  const glintCount = quality === "reduced" ? REDUCED_GLINT_COUNT : FULL_GLINT_COUNT;
  const snowCount = quality === "reduced" ? REDUCED_SNOW_COUNT : FULL_SNOW_COUNT;
  const count = glintCount + snowCount;

  typewriterRoot.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(typewriterRoot);
  const inverseRoot = typewriterRoot.matrixWorld.clone().invert();
  const box = worldBox.clone().applyMatrix4(inverseRoot);
  const size = box.getSize(new THREE.Vector3());

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const kinds = new Float32Array(count);
  const brightness = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const isSnow = index >= glintCount;
    const point = isSnow
      ? localPoint(
          box,
          -0.10 + seeded(index, 20) * 1.20,
          seeded(index, 21),
          0.52 + seeded(index, 22) * 0.58,
        )
      : frostAnchor(box, index);
    const offset = index * 3;
    positions[offset] = point.x;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z;
    sizes[index] = isSnow
      ? 1.4 + seeded(index, 23) * 3.1
      : 1.2 + seeded(index, 24) * 4.6;
    seeds[index] = seeded(index, 25);
    kinds[index] = isSnow ? 1 : 0;
    brightness[index] = isSnow
      ? 0.34 + seeded(index, 26) * 0.34
      : 0.28 + seeded(index, 27) * 0.72;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
  const material = createFrostMaterial();
  const points = new THREE.Points(geometry, material);
  points.name = "SNOW_FROST_SHADER_GLINTS";
  points.renderOrder = 7;
  points.frustumCulled = false;

  const group = new THREE.Group();
  group.name = "FX_SNOW_FROST";
  group.visible = false;
  group.add(points);
  typewriterRoot.add(group);

  const intensityUniform = material.uniforms.uIntensity;
  const timeUniform = material.uniforms.uTime;
  const minYUniform = material.uniforms.uMinY;
  const maxYUniform = material.uniforms.uMaxY;
  const spanXUniform = material.uniforms.uSpanX;
  if (
    !intensityUniform
    || !timeUniform
    || !minYUniform
    || !maxYUniform
    || !spanXUniform
  ) {
    throw new Error("Snow frost shader uniforms are unavailable");
  }
  minYUniform.value = box.min.y;
  maxYUniform.value = box.max.y;
  spanXUniform.value = Math.max(size.x, 0.1);

  let targetProgress = 0;
  let visibleProgress = 0;

  return {
    group,
    setProgress(progress): void {
      targetProgress = clamp01(progress);
    },
    update(now): void {
      visibleProgress = THREE.MathUtils.lerp(
        visibleProgress,
        targetProgress,
        quality === "reduced" ? 0.28 : 0.11,
      );
      group.visible = visibleProgress > 0.003;
      intensityUniform.value = visibleProgress * 0.90;
      timeUniform.value = now * 0.001;
    },
    dispose(): void {
      typewriterRoot.remove(group);
      geometry.dispose();
      material.dispose();
    },
  };
}
