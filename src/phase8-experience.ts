import {normalizeCommand, type CommandDefinition} from "./phase7-content";

export type SceneId = "green" | "snow" | "flower";
export type SceneTransitionPhase = "idle" | "entering" | "active" | "exiting";
export type SceneInputSource = "physical" | "pointer" | "demo" | "auto";
export type SceneInputHandoff = "normal" | "begin-exit" | "defer";

export function resolveSceneInputHandoff(
  phase: SceneTransitionPhase,
  source: SceneInputSource,
): SceneInputHandoff {
  if (source === "auto") return "normal";
  if (phase === "active") return "begin-exit";
  if (phase === "exiting") return "defer";
  return "normal";
}

export interface SceneCommandDefinition {
  readonly keyword: string;
  readonly scene: SceneId;
  readonly archiveTitle: string;
  readonly archiveBody: string;
}

export interface SceneTransitionSnapshot {
  readonly phase: SceneTransitionPhase;
  readonly scene: SceneId | null;
  readonly progress: number;
  readonly environmentVisible: boolean;
  readonly overlayOpacity: number;
  readonly inputLocked: boolean;
}

export const PHASE8_SCENE_COMMANDS: ReadonlyArray<SceneCommandDefinition> = [
  {
    keyword: "green",
    scene: "green",
    archiveTitle: "GREEN / OVERGROWTH",
    archiveBody: [
      "GREEN / OVERGROWTH",
      "",
      "Old vines woke along the typewriter frame.",
      "The first growth is kept in the archive.",
    ].join("\n"),
  },
  {
    keyword: "snow",
    scene: "snow",
    archiveTitle: "SNOW / FROST",
    archiveBody: [
      "SNOW / FROST",
      "",
      "Cold air settled across the typewriter frame.",
      "The first frost is kept in the archive.",
    ].join("\n"),
  },
  {
    keyword: "flower",
    scene: "flower",
    archiveTitle: "FLOWER / URSINIA",
    archiveBody: [
      "FLOWER / URSINIA",
      "",
      "Small wildflowers opened along the old frame.",
      "The first bloom is kept in the archive.",
    ].join("\n"),
  },
];

const sceneCommandByKeyword = new Map(
  PHASE8_SCENE_COMMANDS.map((command) => [command.keyword, command]),
);

export function findSceneCommand(value: string): SceneCommandDefinition | null {
  return sceneCommandByKeyword.get(normalizeCommand(value)) ?? null;
}

export function sceneCommandArchiveDefinition(
  command: SceneCommandDefinition,
): CommandDefinition {
  return {
    keyword: command.keyword,
    title: command.archiveTitle,
    body: command.archiveBody,
    mock: false,
  };
}

export class ExperienceDirector {
  readonly #transitionDurationMs: number;
  #phase: SceneTransitionPhase = "idle";
  #scene: SceneId | null = null;
  #transitionStartedAt = 0;

  constructor(transitionDurationMs = 1500) {
    if (!Number.isFinite(transitionDurationMs) || transitionDurationMs <= 0) {
      throw new Error("Scene transition duration must be positive");
    }
    this.#transitionDurationMs = transitionDurationMs;
  }

  enter(scene: SceneId, now: number): boolean {
    if (this.#phase !== "idle") return false;
    this.#scene = scene;
    this.#phase = "entering";
    this.#transitionStartedAt = now;
    return true;
  }

  exit(now: number): boolean {
    if (this.#phase !== "active" || !this.#scene) return false;
    this.#phase = "exiting";
    this.#transitionStartedAt = now;
    return true;
  }

  update(now: number): SceneTransitionSnapshot {
    let progress = this.#phase === "active" ? 1 : 0;
    if (this.#phase === "entering" || this.#phase === "exiting") {
      progress = Math.min(
        1,
        Math.max(0, (now - this.#transitionStartedAt) / this.#transitionDurationMs),
      );
      if (progress >= 1) {
        if (this.#phase === "entering") {
          this.#phase = "active";
        } else {
          this.#phase = "idle";
          this.#scene = null;
        }
      }
    }
    return this.snapshot(progress);
  }

  snapshot(progress = this.#phase === "active" ? 1 : 0): SceneTransitionSnapshot {
    const transitioning = this.#phase === "entering" || this.#phase === "exiting";
    const environmentVisible = this.#phase !== "idle";
    return {
      phase: this.#phase,
      scene: this.#scene,
      progress,
      environmentVisible,
      overlayOpacity: transitioning ? Math.sin(Math.PI * progress) : 0,
      inputLocked: transitioning,
    };
  }
}
