import type {ArchiveDrawer} from "./phase7-content";

export interface DrawerHitTargetLayout {
  readonly position: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

export function drawerHitTargetLayout(
  side: ArchiveDrawer,
  deskSurfaceY: number,
  openAmount: number,
): DrawerHitTargetLayout {
  const progress = Math.min(1, Math.max(0, openAmount));
  return side === "left"
    ? {
        position: [-0.48, deskSurfaceY - 0.26, 0.18 + progress * 0.39],
        size: [0.78, 0.36, 0.50],
      }
    : {
        position: [0.48, deskSurfaceY - 0.19, 0.18 + progress * 0.325],
        size: [0.70, 0.28, 0.50],
      };
}
