export type MobileLibraryPageDirection = -1 | 0 | 1;

export interface MobileLibraryDragSample {
  readonly direction: MobileLibraryPageDirection;
  readonly progress: number;
  readonly horizontal: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sampleMobileLibraryPageDrag(
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  canPrevious: boolean,
  canNext: boolean,
): MobileLibraryDragSample {
  const horizontal = Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.12;
  if (!horizontal || viewportWidth <= 0) {
    return {direction: 0, progress: 0, horizontal: false};
  }
  const requestedDirection: MobileLibraryPageDirection = deltaX < 0 ? 1 : -1;
  if ((requestedDirection === 1 && !canNext) || (requestedDirection === -1 && !canPrevious)) {
    return {direction: 0, progress: 0, horizontal: true};
  }
  return {
    direction: requestedDirection,
    progress: clamp(Math.abs(deltaX) / (viewportWidth * 0.72), 0, 1),
    horizontal: true,
  };
}

export function shouldCommitMobileLibraryPage(
  progress: number,
  deltaX: number,
  elapsedMs: number,
): boolean {
  const velocity = Math.abs(deltaX) / Math.max(1, elapsedMs);
  return progress >= 0.34 || (Math.abs(deltaX) >= 24 && velocity >= 0.55);
}

export function mobileLibrarySelectionDirection(
  deltaX: number,
  deltaY: number,
): -1 | 0 | 1 {
  if (Math.abs(deltaY) < 48 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.18) return 0;
  return deltaY < 0 ? 1 : -1;
}
