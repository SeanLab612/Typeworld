export interface ProjectBookIndexPose {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
}

const SELECTED_ROTATION = [-0.04, -0.18, -0.035] as const;
const STACKED_ROTATION = [-1.12, 0.12, Math.PI / 2] as const;

/**
 * Canonical index pose shared by the legacy Projects page and the in-room
 * library. Keeping this in one place prevents the homepage from approximating
 * the approved second-page composition with a different set of transforms.
 */
export function projectBookIndexPose(relativeIndex: number): ProjectBookIndexPose {
  if (relativeIndex === 0) {
    return {
      position: [0.12, -0.02, 0.52],
      rotation: SELECTED_ROTATION,
      scale: 0.83,
    };
  }

  const direction = Math.sign(relativeIndex);
  const slot = Math.abs(relativeIndex);
  return {
    position: [
      -1.18 + slot * 0.025,
      -relativeIndex * 0.48,
      -0.22 - slot * 0.1,
    ],
    rotation: [
      STACKED_ROTATION[0],
      STACKED_ROTATION[1] + direction * 0.025,
      STACKED_ROTATION[2],
    ],
    scale: Math.max(0.58, 0.74 - slot * 0.035),
  };
}
