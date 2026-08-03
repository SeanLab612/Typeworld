import {describe, expect, it} from "vitest";
import {
  advanceFirePaperPhase,
  applyFireArchiveTransaction,
  createFireTriggerSnapshot,
  sampleFirePaperTimeline,
} from "./fire-paper-state";
import {createEmptyArchive} from "./phase7-content";

describe("fire trigger snapshot", () => {
  it("archives only the first keyword print when fire is the whole paper", () => {
    expect(createFireTriggerSnapshot("fire", "paper-1", false)).toEqual({
      keyword: "fire",
      ordinaryContentBeforeTrigger: "",
      sourcePaperId: "paper-1",
      discoveredBefore: false,
      shouldArchiveOrdinaryPaper: false,
      shouldArchiveFirstKeywordPrint: true,
    });
  });

  it("separates ordinary content from the final fire trigger line", () => {
    const snapshot = createFireTriggerSnapshot(
      "A note worth keeping.\nSecond line.\nfire",
      "paper-2",
      false,
    );
    expect(snapshot?.ordinaryContentBeforeTrigger).toBe(
      "A note worth keeping.\nSecond line.",
    );
    expect(snapshot?.shouldArchiveOrdinaryPaper).toBe(true);
    expect(snapshot?.shouldArchiveFirstKeywordPrint).toBe(true);
  });

  it("does not request another keyword record after first discovery", () => {
    const snapshot = createFireTriggerSnapshot(
      "keep this\n FIRE ",
      "paper-3",
      true,
    );
    expect(snapshot?.ordinaryContentBeforeTrigger).toBe("keep this");
    expect(snapshot?.shouldArchiveOrdinaryPaper).toBe(true);
    expect(snapshot?.shouldArchiveFirstKeywordPrint).toBe(false);
  });

  it("rejects papers whose final line is not the fire trigger", () => {
    expect(createFireTriggerSnapshot("fire\nkeep typing", "paper-4", false))
      .toBeNull();
  });
});

describe("fire paper phase transitions", () => {
  it("follows archive, ignition, burn, and replacement in order", () => {
    let phase = advanceFirePaperPhase("idle", "trigger");
    expect(phase).toBe("archiving");
    phase = advanceFirePaperPhase(phase, "archive-complete");
    expect(phase).toBe("igniting");
    phase = advanceFirePaperPhase(phase, "ignition-complete");
    expect(phase).toBe("burning");
    phase = advanceFirePaperPhase(phase, "burn-complete");
    expect(phase).toBe("replacing");
    phase = advanceFirePaperPhase(phase, "replacement-complete");
    expect(phase).toBe("complete");
  });

  it("recovers animation failures by forcing replacement", () => {
    expect(advanceFirePaperPhase("igniting", "recover")).toBe("replacing");
    expect(advanceFirePaperPhase("burning", "recover")).toBe("replacing");
  });
});

describe("fire archive transaction", () => {
  it("atomically stores ordinary content right and first discovery left", () => {
    const trigger = createFireTriggerSnapshot(
      "keep this note\nfire",
      "paper-5",
      false,
    )!;
    const transaction = applyFireArchiveTransaction(
      createEmptyArchive(),
      trigger,
      "2026-07-31T11:00:00.000Z",
      "test-1",
    );

    expect(transaction.ordinaryDocument?.drawer).toBe("right");
    expect(transaction.ordinaryDocument?.text).toBe("keep this note");
    expect(transaction.keywordDocument?.drawer).toBe("left");
    expect(transaction.keywordDocument?.keyword).toBe("fire");
    expect(transaction.keywordDocument?.text).toBe("fire");
    expect(transaction.snapshot.documents).toHaveLength(2);
    expect(transaction.snapshot.discovered).toContain("fire");
  });

  it("never duplicates the left keyword record on repeated triggers", () => {
    const firstTrigger = createFireTriggerSnapshot("fire", "paper-6", false)!;
    const first = applyFireArchiveTransaction(
      createEmptyArchive(),
      firstTrigger,
      "2026-07-31T11:00:00.000Z",
      "test-2",
    );
    const repeatedTrigger = createFireTriggerSnapshot(
      "another note\nfire",
      "paper-7",
      true,
    )!;
    const repeated = applyFireArchiveTransaction(
      first.snapshot,
      repeatedTrigger,
      "2026-07-31T11:05:00.000Z",
      "test-3",
    );

    expect(repeated.keywordDocument).toBeNull();
    expect(
      repeated.snapshot.documents.filter((document) => (
        document.kind === "command" && document.keyword === "fire"
      )),
    ).toHaveLength(1);
    expect(repeated.ordinaryDocument?.text).toBe("another note");
  });
});

describe("fire paper timeline", () => {
  it("keeps archive, burn, and replacement as ordered visual phases", () => {
    expect(sampleFirePaperTimeline(0).phase).toBe("archiving");
    expect(sampleFirePaperTimeline(300).phase).toBe("igniting");
    expect(sampleFirePaperTimeline(1_200).phase).toBe("burning");
    expect(sampleFirePaperTimeline(2_700).phase).toBe("replacing");
    expect(sampleFirePaperTimeline(3_000).complete).toBe(true);
  });

  it("provides a shorter reduced-motion replacement path", () => {
    expect(sampleFirePaperTimeline(400, true).phase).toBe("burning");
    expect(sampleFirePaperTimeline(750, true).phase).toBe("replacing");
    expect(sampleFirePaperTimeline(900, true).complete).toBe(true);
  });
});
