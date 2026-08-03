export interface ImmersiveChromeContext {
  readonly viewMode: "hero" | "typing" | "archive" | "library" | "scene";
  readonly experienceMode: "typing" | "presented" | "archiving" | "burning" | "smiling" | "scene-transition";
  readonly idleForMs: number;
  readonly idleThresholdMs: number;
  readonly coarsePointer: boolean;
  readonly controlFocused: boolean;
  readonly loading: boolean;
}

export const IMMERSIVE_CHROME_MESSAGE = "typeworld:immersive-chrome";
export const SHELL_ACTIVITY_MESSAGE = "typeworld:shell-activity";

export function shouldHideImmersiveChrome(context: ImmersiveChromeContext): boolean {
  return !context.loading
    && !context.coarsePointer
    && !context.controlFocused
    && context.experienceMode === "typing"
    && context.viewMode === "hero"
    && context.idleForMs >= context.idleThresholdMs;
}

export function immersiveChromeMessage(hidden: boolean): {
  type: typeof IMMERSIVE_CHROME_MESSAGE;
  hidden: boolean;
} {
  return {type: IMMERSIVE_CHROME_MESSAGE, hidden};
}

export function isImmersiveChromeMessage(
  value: unknown,
): value is ReturnType<typeof immersiveChromeMessage> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {type?: unknown; hidden?: unknown};
  return candidate.type === IMMERSIVE_CHROME_MESSAGE
    && typeof candidate.hidden === "boolean";
}

export function isShellActivityMessage(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (value as {type?: unknown}).type === SHELL_ACTIVITY_MESSAGE;
}
