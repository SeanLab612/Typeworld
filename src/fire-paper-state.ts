import {
  archiveDocument,
  createCommandDocument,
  createFreeformDocument,
  hasArchivedCommand,
  normalizeCommand,
  type ArchiveDocument,
  type ArchiveSnapshot,
  type CommandDefinition,
} from "./phase7-content";

export const FIRE_KEYWORD = "fire";
export const FIRE_COMMAND: CommandDefinition = {
  keyword: FIRE_KEYWORD,
  title: "FIRE",
  body: FIRE_KEYWORD,
  mock: false,
};

export type FirePaperPhase =
  | "idle"
  | "archiving"
  | "igniting"
  | "burning"
  | "replacing"
  | "complete";

export type FirePaperEvent =
  | "trigger"
  | "archive-complete"
  | "ignition-complete"
  | "burn-complete"
  | "replacement-complete"
  | "recover";

export interface FireTriggerSnapshot {
  readonly keyword: typeof FIRE_KEYWORD;
  readonly ordinaryContentBeforeTrigger: string;
  readonly sourcePaperId: string;
  readonly discoveredBefore: boolean;
  readonly shouldArchiveOrdinaryPaper: boolean;
  readonly shouldArchiveFirstKeywordPrint: boolean;
}

export interface FireArchiveTransaction {
  readonly snapshot: ArchiveSnapshot;
  readonly ordinaryDocument: ArchiveDocument | null;
  readonly keywordDocument: ArchiveDocument | null;
}

export interface FirePaperTimelineSample {
  readonly phase: FirePaperPhase;
  readonly burnProgress: number;
  readonly replacementProgress: number;
  readonly complete: boolean;
}

function normalizedLines(value: string): string[] {
  return value.replace(/\r\n?/gu, "\n").split("\n");
}

export function createFireTriggerSnapshot(
  paperContent: string,
  sourcePaperId: string,
  discoveredBefore: boolean,
): FireTriggerSnapshot | null {
  const lines = normalizedLines(paperContent);
  const triggerLine = lines.at(-1) ?? "";
  if (normalizeCommand(triggerLine) !== FIRE_KEYWORD) return null;
  const ordinaryContentBeforeTrigger = lines
    .slice(0, -1)
    .join("\n")
    .trim();
  return {
    keyword: FIRE_KEYWORD,
    ordinaryContentBeforeTrigger,
    sourcePaperId,
    discoveredBefore,
    shouldArchiveOrdinaryPaper: ordinaryContentBeforeTrigger.length > 0,
    shouldArchiveFirstKeywordPrint: !discoveredBefore,
  };
}

const FIRE_PHASE_TRANSITIONS: Readonly<
  Partial<Record<FirePaperPhase, Partial<Record<FirePaperEvent, FirePaperPhase>>>>
> = {
  idle: {trigger: "archiving"},
  archiving: {
    "archive-complete": "igniting",
    recover: "replacing",
  },
  igniting: {
    "ignition-complete": "burning",
    recover: "replacing",
  },
  burning: {
    "burn-complete": "replacing",
    recover: "replacing",
  },
  replacing: {
    "replacement-complete": "complete",
    recover: "replacing",
  },
  complete: {},
};

export function advanceFirePaperPhase(
  phase: FirePaperPhase,
  event: FirePaperEvent,
): FirePaperPhase {
  return FIRE_PHASE_TRANSITIONS[phase]?.[event] ?? phase;
}

export function applyFireArchiveTransaction(
  archiveSnapshot: ArchiveSnapshot,
  trigger: FireTriggerSnapshot,
  createdAt: string,
  idSuffix: string,
): FireArchiveTransaction {
  let nextSnapshot = archiveSnapshot;
  let ordinaryDocument: ArchiveDocument | null = null;
  let keywordDocument: ArchiveDocument | null = null;

  if (trigger.shouldArchiveOrdinaryPaper) {
    ordinaryDocument = createFreeformDocument(
      trigger.ordinaryContentBeforeTrigger,
      createdAt,
      `freeform-fire-${idSuffix}`,
    );
    nextSnapshot = archiveDocument(nextSnapshot, ordinaryDocument);
  }

  if (
    trigger.shouldArchiveFirstKeywordPrint
    && !hasArchivedCommand(nextSnapshot, FIRE_KEYWORD)
  ) {
    keywordDocument = createCommandDocument(
      FIRE_COMMAND,
      createdAt,
      `fire-${idSuffix}`,
    );
    nextSnapshot = archiveDocument(nextSnapshot, keywordDocument);
  }

  return {snapshot: nextSnapshot, ordinaryDocument, keywordDocument};
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function sampleFirePaperTimeline(
  elapsedMs: number,
  reducedMotion = false,
): FirePaperTimelineSample {
  const elapsed = Math.max(0, elapsedMs);
  const archiveEnd = reducedMotion ? 80 : 160;
  const ignitionEnd = reducedMotion ? 180 : 600;
  const burnEnd = reducedMotion ? 600 : 2_400;
  const replacementEnd = reducedMotion ? 900 : 3_000;

  if (elapsed < archiveEnd) {
    return {
      phase: "archiving",
      burnProgress: 0,
      replacementProgress: 0,
      complete: false,
    };
  }
  if (elapsed < ignitionEnd) {
    const ignitionProgress = clamp01(
      (elapsed - archiveEnd) / (ignitionEnd - archiveEnd),
    );
    return {
      phase: "igniting",
      burnProgress: ignitionProgress * 0.08,
      replacementProgress: 0,
      complete: false,
    };
  }
  if (elapsed < burnEnd) {
    const burningProgress = clamp01(
      (elapsed - ignitionEnd) / (burnEnd - ignitionEnd),
    );
    return {
      phase: "burning",
      burnProgress: 0.08 + burningProgress * 0.92,
      replacementProgress: 0,
      complete: false,
    };
  }
  if (elapsed < replacementEnd) {
    return {
      phase: "replacing",
      burnProgress: 1,
      replacementProgress: clamp01(
        (elapsed - burnEnd) / (replacementEnd - burnEnd),
      ),
      complete: false,
    };
  }
  return {
    phase: "complete",
    burnProgress: 1,
    replacementProgress: 1,
    complete: true,
  };
}
