import {describe, expect, it} from "vitest";
import {
  applySmileArchiveTransaction,
  createSmileTriggerSnapshot,
  sampleSmilePaperTimeline,
  shouldDismissSmilePaperForInput,
} from "./smile-paper-state";
import {createEmptyArchive, documentsForDrawer} from "./phase7-content";

describe("smile paper transaction", () => {
  it("dismisses the completed smile when the visitor starts new input", () => {
    expect(shouldDismissSmilePaperForInput(true, "physical")).toBe(true);
    expect(shouldDismissSmilePaperForInput(true, "pointer")).toBe(true);
    expect(shouldDismissSmilePaperForInput(true, "auto")).toBe(false);
    expect(shouldDismissSmilePaperForInput(false, "physical")).toBe(false);
  });

  it("requires smile as the complete final line", () => {
    expect(createSmileTriggerSnapshot("note\nsmiles", "paper-1", false)).toBeNull();
    expect(createSmileTriggerSnapshot("note\n SMILE ", "paper-1", false)).toMatchObject({
      keyword: "smile",
      ordinaryContentBeforeTrigger: "note",
    });
  });

  it("archives prior content right and the first smile print left", () => {
    const trigger = createSmileTriggerSnapshot("private note\nsmile", "paper-1", false);
    expect(trigger).not.toBeNull();
    if (!trigger) return;
    const transaction = applySmileArchiveTransaction(
      createEmptyArchive(),
      trigger,
      "2026-07-31T10:00:00.000Z",
      "first",
    );
    expect(documentsForDrawer(transaction.snapshot, "right")[0]?.text).toBe("private note");
    expect(documentsForDrawer(transaction.snapshot, "left")[0]).toMatchObject({
      keyword: "smile",
      text: "smile",
    });
    expect(transaction.snapshot.discovered).toEqual(["smile"]);
  });

  it("never duplicates the keyword print on repeated triggers", () => {
    const first = createSmileTriggerSnapshot("smile", "paper-1", false);
    expect(first).not.toBeNull();
    if (!first) return;
    const firstResult = applySmileArchiveTransaction(
      createEmptyArchive(),
      first,
      "2026-07-31T10:00:00.000Z",
      "first",
    );
    const repeated = createSmileTriggerSnapshot("smile", "paper-2", true);
    expect(repeated).not.toBeNull();
    if (!repeated) return;
    const repeatedResult = applySmileArchiveTransaction(
      firstResult.snapshot,
      repeated,
      "2026-07-31T10:01:00.000Z",
      "second",
    );
    expect(documentsForDrawer(repeatedResult.snapshot, "left")).toHaveLength(1);
    expect(repeatedResult.keywordDocument).toBeNull();
  });

  it("draws progressively and supports reduced motion", () => {
    expect(sampleSmilePaperTimeline(0)).toEqual({drawProgress: 0, complete: false});
    expect(sampleSmilePaperTimeline(700).drawProgress).toBeGreaterThan(0.5);
    expect(sampleSmilePaperTimeline(1_350)).toEqual({drawProgress: 1, complete: true});
    expect(sampleSmilePaperTimeline(180, true)).toEqual({drawProgress: 1, complete: true});
  });
});
