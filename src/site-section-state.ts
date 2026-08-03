import type {ArchiveDrawer} from "./phase7-content";

export function shouldCloseSelectedDrawer(
  activeDrawer: ArchiveDrawer | null,
  requestedDrawerIsOpen: boolean,
  requestedDrawer: ArchiveDrawer,
): boolean {
  return activeDrawer === requestedDrawer || requestedDrawerIsOpen;
}
