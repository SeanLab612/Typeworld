export interface LibraryJourneyContext {
  readonly viewMode: "hero" | "typing" | "archive" | "library" | "scene";
  readonly experienceMode: "typing" | "presented" | "archiving" | "burning" | "smiling" | "scene-transition";
  readonly loading: boolean;
  readonly firstVisitBlocking: boolean;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function smootherstep01(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function libraryJourneyAutoplayProgress(
  startProgress: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return 1;
  return startProgress
    + (1 - startProgress) * smootherstep01(elapsedMs / durationMs);
}

export function canBeginLibraryJourney(context: LibraryJourneyContext): boolean {
  return (context.viewMode === "hero" || context.viewMode === "typing")
    && context.experienceMode === "typing"
    && !context.loading
    && !context.firstVisitBlocking;
}

export function nextLibraryJourneyTarget(
  current: number,
  deltaY: number,
  sensitivity = 0.0012,
): number {
  const boundedDelta = Math.min(120, Math.max(-120, deltaY));
  return clamp01(current + boundedDelta * sensitivity);
}

export function libraryJourneyCameraProgress(progress: number): number {
  return smoothstep01(clamp01(progress) / 0.64);
}

export function libraryJourneyBookProgress(
  progress: number,
  index: number,
  count: number,
): number {
  const safeCount = Math.max(1, count);
  const stagger = safeCount === 1 ? 0 : index / (safeCount - 1);
  const start = 0.34 + stagger * 0.19;
  const end = start + 0.36;
  return smoothstep01((clamp01(progress) - start) / (end - start));
}

export function shouldCompleteLibraryJourney(
  targetProgress: number,
  displayedProgress: number,
): boolean {
  return targetProgress >= 0.999 && displayedProgress >= 0.992;
}

export function shouldRestoreLibraryHero(
  targetProgress: number,
  displayedProgress: number,
): boolean {
  return targetProgress <= 0.001 && displayedProgress <= 0.006;
}

export function nextLibrarySelectionIndex(
  current: number,
  direction: -1 | 1,
  count: number,
): number {
  return Math.min(Math.max(0, count - 1), Math.max(0, current + direction));
}
