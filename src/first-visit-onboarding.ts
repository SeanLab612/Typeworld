export const FIRST_VISIT_GREETING = [
  "HELLO, STRANGER.",
  "TYPE ANYTHING YOU LIKE.",
  "SOME WORDS MAY CHANGE THE ROOM.",
  "THE LIBRARY WAITS BELOW.",
].join("\n");

export const FIRST_VISIT_MOBILE_GREETING = [
  "HELLO, STRANGER.",
  "TYPE ANYTHING YOU LIKE.",
  "SOME WORDS MAY CHANGE THE ROOM.",
  "TAP LIBRARY TO ENTER.",
].join("\n");

export const FIRST_VISIT_DESKTOP_READY_MESSAGE =
  "欢迎来到 Typeworld · 输入 GREEN 并回车，或向下滚动进入书架";
export const FIRST_VISIT_MOBILE_READY_MESSAGE =
  "欢迎来到 Typeworld · 输入 GREEN 并回车，或点击 LIBRARY 进入书架";

export const FIRST_VISIT_STORAGE_KEY = "typeworld-first-visit-onboarding";
export const FIRST_VISIT_VERSION = "phase-13-library-v1";

export type FirstVisitOnboardingPhase =
  | "off"
  | "scheduled"
  | "typing"
  | "waiting"
  | "replacing"
  | "complete";

export interface OnboardingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function shouldRunFirstVisitOnboarding(
  storage: OnboardingStorage,
  suppressed = false,
): boolean {
  if (suppressed) return false;
  try {
    return storage.getItem(FIRST_VISIT_STORAGE_KEY) !== FIRST_VISIT_VERSION;
  } catch {
    return true;
  }
}

export function markFirstVisitOnboardingSeen(storage: OnboardingStorage): boolean {
  try {
    storage.setItem(FIRST_VISIT_STORAGE_KEY, FIRST_VISIT_VERSION);
    return true;
  } catch {
    return false;
  }
}

export function isFirstVisitSpotlightActive(phase: FirstVisitOnboardingPhase): boolean {
  return phase === "scheduled" || phase === "typing";
}

export function shouldDismissFirstVisitForLibrary(phase: FirstVisitOnboardingPhase): boolean {
  return phase === "scheduled"
    || phase === "typing"
    || phase === "waiting"
    || phase === "replacing";
}

export function firstVisitMechanismDuration(
  baseDurationMs: number,
  mobile: boolean,
  accelerated = false,
): number {
  if (accelerated) return Math.max(24, Math.round(baseDurationMs * 0.24));
  return mobile ? Math.max(36, Math.round(baseDurationMs * 0.42)) : baseDurationMs;
}
