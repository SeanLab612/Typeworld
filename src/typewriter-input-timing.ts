import type {QueuedInput} from "./typewriter-state";

export function mechanismDurationMs(input: QueuedInput, queuedBehind: number): number {
  if (input.source === "auto") return input.key.kind === "enter" ? 190 : 95;

  if (input.key.kind === "enter") {
    if (queuedBehind >= 3) return 320;
    return 520;
  }

  if (input.source === "physical" || input.source === "pointer") {
    if (queuedBehind >= 5) return 105;
    if (queuedBehind >= 2) return 145;
    return 220;
  }

  return 260;
}
