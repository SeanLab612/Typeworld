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

export const SMILE_KEYWORD = "smile";
export const SMILE_COMMAND: CommandDefinition = {
  keyword: SMILE_KEYWORD,
  title: "SMILE / HAND DRAWN",
  body: SMILE_KEYWORD,
  mock: false,
};

export interface SmileTriggerSnapshot {
  readonly keyword: typeof SMILE_KEYWORD;
  readonly ordinaryContentBeforeTrigger: string;
  readonly sourcePaperId: string;
  readonly discoveredBefore: boolean;
  readonly shouldArchiveOrdinaryPaper: boolean;
  readonly shouldArchiveFirstKeywordPrint: boolean;
}

export interface SmileArchiveTransaction {
  readonly snapshot: ArchiveSnapshot;
  readonly ordinaryDocument: ArchiveDocument | null;
  readonly keywordDocument: ArchiveDocument | null;
}

export interface SmilePaperTimelineSample {
  readonly drawProgress: number;
  readonly complete: boolean;
}

export function shouldDismissSmilePaperForInput(
  smileActive: boolean,
  source: "physical" | "pointer" | "demo" | "auto",
): boolean {
  return smileActive && source !== "auto";
}

function normalizedLines(value: string): string[] {
  return value.replace(/\r\n?/gu, "\n").split("\n");
}

export function createSmileTriggerSnapshot(
  paperContent: string,
  sourcePaperId: string,
  discoveredBefore: boolean,
): SmileTriggerSnapshot | null {
  const lines = normalizedLines(paperContent);
  const triggerLine = lines.at(-1) ?? "";
  if (normalizeCommand(triggerLine) !== SMILE_KEYWORD) return null;
  const ordinaryContentBeforeTrigger = lines
    .slice(0, -1)
    .join("\n")
    .trim();
  return {
    keyword: SMILE_KEYWORD,
    ordinaryContentBeforeTrigger,
    sourcePaperId,
    discoveredBefore,
    shouldArchiveOrdinaryPaper: ordinaryContentBeforeTrigger.length > 0,
    shouldArchiveFirstKeywordPrint: !discoveredBefore,
  };
}

export function applySmileArchiveTransaction(
  snapshot: ArchiveSnapshot,
  trigger: SmileTriggerSnapshot,
  createdAt: string,
  idSuffix: string,
): SmileArchiveTransaction {
  let nextSnapshot = snapshot;
  let ordinaryDocument: ArchiveDocument | null = null;
  let keywordDocument: ArchiveDocument | null = null;

  if (trigger.shouldArchiveOrdinaryPaper) {
    ordinaryDocument = createFreeformDocument(
      trigger.ordinaryContentBeforeTrigger,
      createdAt,
      `freeform-smile-${idSuffix}`,
    );
    nextSnapshot = archiveDocument(nextSnapshot, ordinaryDocument);
  }

  if (
    trigger.shouldArchiveFirstKeywordPrint
    && !hasArchivedCommand(nextSnapshot, SMILE_KEYWORD)
  ) {
    keywordDocument = createCommandDocument(
      SMILE_COMMAND,
      createdAt,
      `smile-${idSuffix}`,
    );
    nextSnapshot = archiveDocument(nextSnapshot, keywordDocument);
  }

  return {snapshot: nextSnapshot, ordinaryDocument, keywordDocument};
}

export function sampleSmilePaperTimeline(
  elapsedMs: number,
  reducedMotion = false,
): SmilePaperTimelineSample {
  const duration = reducedMotion ? 180 : 1_350;
  const progress = Math.min(1, Math.max(0, elapsedMs / duration));
  return {
    drawProgress: 1 - (1 - progress) ** 3,
    complete: progress >= 1,
  };
}
