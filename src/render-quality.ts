import type * as THREE from "three";

export interface RenderQualitySignals {
  readonly devicePixelRatio: number;
  readonly viewportWidth: number;
  readonly hardwareConcurrency: number;
  readonly reducedMotion: boolean;
}

export function resolveRenderPixelRatio(signals: RenderQualitySignals): number {
  const requested = Number.isFinite(signals.devicePixelRatio)
    ? Math.max(1, signals.devicePixelRatio)
    : 1;
  const lowPower = signals.hardwareConcurrency > 0 && signals.hardwareConcurrency <= 4;
  const compact = signals.viewportWidth <= 720;
  // Retina hero rendering is fill-rate bound. A 1.5 desktop cap preserves
  // close-up paper and key detail while removing roughly 27% of the pixels
  // rendered by the former 1.75 cap.
  const cap = compact || lowPower || signals.reducedMotion ? 1.35 : 1.5;
  return Math.min(requested, cap);
}

export function currentRenderPixelRatio(): number {
  return resolveRenderPixelRatio({
    devicePixelRatio: globalThis.devicePixelRatio ?? 1,
    viewportWidth: globalThis.innerWidth ?? 1280,
    hardwareConcurrency: globalThis.navigator?.hardwareConcurrency ?? 8,
    reducedMotion: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  });
}

export function resolveShadowMapSize(
  viewportWidth: number,
  hardwareConcurrency: number,
): 1024 | 2048 {
  return viewportWidth <= 900 || (hardwareConcurrency > 0 && hardwareConcurrency <= 4)
    ? 1024
    : 2048;
}

export function currentShadowMapSize(): 1024 | 2048 {
  return resolveShadowMapSize(
    globalThis.innerWidth ?? 1280,
    globalThis.navigator?.hardwareConcurrency ?? 8,
  );
}

export function resizeThreeViewport(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(currentRenderPixelRatio());
  renderer.setSize(innerWidth, innerHeight);
}
