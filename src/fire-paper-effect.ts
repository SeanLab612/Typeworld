import * as THREE from "three";

export interface FirePaperEffectRuntime {
  readonly material: THREE.MeshStandardMaterial;
  setBurnOrigin(x: number, y: number): void;
  setProgress(progress: number): void;
  dispose(): void;
}

interface FireShaderUniforms {
  readonly uFireBurnProgress: {value: number};
  readonly uFireBurnOrigin: {value: THREE.Vector2};
  readonly uFireSeed: {value: number};
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function createFirePaperEffect(
  baseMaterial: THREE.MeshStandardMaterial,
  seed = Math.random() * 100,
): FirePaperEffectRuntime {
  const material = baseMaterial.clone();
  material.name = "PAPER_FIRE_BURN_MATERIAL";
  material.transparent = true;
  material.depthWrite = true;
  const uniforms: FireShaderUniforms = {
    uFireBurnProgress: {value: 0},
    uFireBurnOrigin: {value: new THREE.Vector2(0.52, 0.72)},
    uFireSeed: {value: seed},
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
          #include <common>
          varying vec2 vFirePaperUv;
        `,
      )
      .replace(
        "#include <uv_vertex>",
        `
          #include <uv_vertex>
          vFirePaperUv = uv;
        `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `
          #include <common>
          varying vec2 vFirePaperUv;
          uniform float uFireBurnProgress;
          uniform vec2 uFireBurnOrigin;
          uniform float uFireSeed;

          float fireHash(vec2 point) {
            point = fract(point * vec2(123.34, 456.21));
            point += dot(point, point + 45.32 + uFireSeed);
            return fract(point.x * point.y);
          }

          float fireNoise(vec2 point) {
            vec2 cell = floor(point);
            vec2 local = fract(point);
            local = local * local * (3.0 - 2.0 * local);
            return mix(
              mix(
                fireHash(cell),
                fireHash(cell + vec2(1.0, 0.0)),
                local.x
              ),
              mix(
                fireHash(cell + vec2(0.0, 1.0)),
                fireHash(cell + vec2(1.0, 1.0)),
                local.x
              ),
              local.y
            );
          }

          float fireFbm(vec2 point) {
            float value = 0.0;
            float amplitude = 0.56;
            for (int octave = 0; octave < 3; octave++) {
              value += fireNoise(point) * amplitude;
              point = point * 2.07 + vec2(7.3, 3.9);
              amplitude *= 0.48;
            }
            return value;
          }
        `,
      )
      .replace(
        "#include <map_fragment>",
        `
          #include <map_fragment>
          if (uFireBurnProgress > 0.0005) {
            vec2 fireVector = (vFirePaperUv - uFireBurnOrigin)
              * vec2(1.0, 1.32);
            float broadNoise = fireFbm(vFirePaperUv * 5.2 + uFireSeed);
            float fiberNoise = fireNoise(
              vFirePaperUv * vec2(22.0, 8.0) + uFireSeed * 0.37
            );
            float burnField = length(fireVector)
              + (broadNoise - 0.5) * 0.23
              + (fiberNoise - 0.5) * 0.055;
            float burnRadius = uFireBurnProgress * 1.42;
            float burnDelta = burnField - burnRadius;
            if (burnDelta < -0.028) discard;

            float charBand = 1.0 - smoothstep(0.018, 0.14, burnDelta);
            float emberBand = 1.0 - smoothstep(0.0, 0.045, abs(burnDelta));
            vec3 charColor = vec3(0.055, 0.018, 0.006);
            vec3 emberColor = vec3(2.5, 0.34, 0.025);
            diffuseColor.rgb = mix(diffuseColor.rgb, charColor, charBand * 0.96);
            diffuseColor.rgb += emberColor * emberBand;
          }
        `,
      );
  };
  material.customProgramCacheKey = () => "typeworld-fire-paper-v1";
  material.needsUpdate = true;

  return {
    material,
    setBurnOrigin(x: number, y: number) {
      uniforms.uFireBurnOrigin.value.set(clamp01(x), clamp01(y));
    },
    setProgress(progress: number) {
      uniforms.uFireBurnProgress.value = clamp01(progress);
    },
    dispose() {
      material.dispose();
    },
  };
}
