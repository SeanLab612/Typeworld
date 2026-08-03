import type {KeyKind} from "./typewriter-state";

export type TypewriterFocusTarget = "editing" | "control" | "other";
export type TypewriterExperienceMode = "typing" | "smiling" | "blocked";

export function canRouteTypewriterExperienceInput(
  mode: TypewriterExperienceMode,
  sceneExitBufferActive: boolean,
  completedSmilePaperActive: boolean,
): boolean {
  return mode === "typing"
    || sceneExitBufferActive
    || (mode === "smiling" && completedSmilePaperActive);
}

export function shouldRouteTypewriterKey(
  target: TypewriterFocusTarget,
  keyKind: KeyKind,
): boolean {
  if (target === "editing") return false;
  if (target === "control") {
    return keyKind === "print" || keyKind === "backspace";
  }
  return true;
}
