import * as THREE from "three";

export interface ProjectCoverLoadResult {
  readonly texture: THREE.Texture;
  readonly degraded: boolean;
}

export function createFallbackProjectCover(
  color: THREE.ColorRepresentation,
): THREE.DataTexture {
  const fallbackColor = new THREE.Color(color);
  const bytes = new Uint8Array([
    Math.round(fallbackColor.r * 255),
    Math.round(fallbackColor.g * 255),
    Math.round(fallbackColor.b * 255),
    255,
  ]);
  const texture = new THREE.DataTexture(bytes, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export async function loadProjectCover(
  loader: THREE.TextureLoader,
  url: string,
  fallbackColor: THREE.ColorRepresentation,
): Promise<ProjectCoverLoadResult> {
  try {
    return {texture: await loader.loadAsync(url), degraded: false};
  } catch {
    return {texture: createFallbackProjectCover(fallbackColor), degraded: true};
  }
}
