import {describe, expect, it} from "vitest";
import {
  ARCHIVE_STORAGE_KEY,
  ARCHIVE_MAX_DOCUMENTS,
  ARCHIVE_MAX_SERIALIZED_LENGTH,
  ARCHIVE_MAX_TEXT_LENGTH,
  ARCHIVE_VISIBLE_CAPACITY,
  archiveDocument,
  createCommandDocument,
  createEmptyArchive,
  createFreeformDocument,
  documentsForDrawer,
  findCommand,
  hasArchivedCommand,
  parseArchiveSnapshot,
  PHASE7_COMMANDS,
  isDrawerVisuallyFull,
  LEGACY_ARCHIVE_STORAGE_KEY,
  visiblePaperCount,
} from "../src/phase7-content";

describe("Phase 7 command registry and archive", () => {
  it("uses Typeworld storage while preserving a legacy migration source", () => {
    expect(ARCHIVE_STORAGE_KEY).toBe("typeworld.phase7.archive.v1");
    expect(LEGACY_ARCHIVE_STORAGE_KEY).toBe("typeword.phase7.archive.v1");
  });

  it("retires the old personal navigation commands", () => {
    expect(findCommand("  ABOUT  ")).toBeNull();
    expect(findCommand("Contact")).toBeNull();
    expect(findCommand("projects")).toBeNull();
    expect(PHASE7_COMMANDS).toEqual([]);
  });

  it("publishes concise real content that fits the mechanical paper", () => {
    for (const command of PHASE7_COMMANDS) {
      const lines = command.body.split("\n");
      expect(command.mock).toBe(false);
      expect(command.title).not.toContain("MOCK");
      expect(command.body).not.toContain("MOCK");
      expect(lines.length).toBeLessThanOrEqual(12);
      expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(38);
    }
  });

  it("does not expose GitHub account information in public command papers", () => {
    const publicCopy = JSON.stringify(PHASE7_COMMANDS).toLowerCase();
    expect(publicCopy).not.toContain("github");
    expect(publicCopy).not.toContain("legacy-private-account");
  });

  it("stores a discovered effect command in the left drawer only once", () => {
    const green = {
      keyword: "green",
      title: "GREEN / OVERGROWTH",
      body: "Old vines woke along the frame.",
      mock: false,
    } as const;
    let snapshot = createEmptyArchive();
    snapshot = archiveDocument(snapshot, createCommandDocument(green, "2026-07-29T10:00:00Z", "g"));
    snapshot = archiveDocument(snapshot, createCommandDocument(green, "2026-07-29T10:02:00Z", "g2"));

    expect(snapshot.discovered).toEqual(["green"]);
    expect(documentsForDrawer(snapshot, "left").map((item) => item.id)).toEqual(["g"]);
    expect(documentsForDrawer(snapshot, "right")).toEqual([]);
    expect(hasArchivedCommand(snapshot, "green")).toBe(true);
  });

  it("stores freeform papers in the right drawer when a new sheet is requested", () => {
    let snapshot = createEmptyArchive();
    snapshot = archiveDocument(
      snapshot,
      createFreeformDocument("hello world", "2026-07-29T10:00:00Z", "f-1"),
    );
    snapshot = archiveDocument(
      snapshot,
      createFreeformDocument("another note", "2026-07-29T10:01:00Z", "f-2"),
    );

    expect(documentsForDrawer(snapshot, "left")).toEqual([]);
    expect(documentsForDrawer(snapshot, "right").map((item) => item.id)).toEqual(["f-2", "f-1"]);
    expect(snapshot.discovered).toEqual([]);
  });

  it("keeps unlimited right-side history while saturating its visible paper stack", () => {
    let snapshot = createEmptyArchive();
    for (let index = 0; index < ARCHIVE_VISIBLE_CAPACITY.right + 3; index += 1) {
      snapshot = archiveDocument(
        snapshot,
        createFreeformDocument(
          `note ${index}`,
          `2026-07-29T10:${String(index).padStart(2, "0")}:00Z`,
          `f-${index}`,
        ),
      );
    }
    expect(documentsForDrawer(snapshot, "right")).toHaveLength(63);
    expect(visiblePaperCount(snapshot, "right")).toBe(60);
    expect(isDrawerVisuallyFull(snapshot, "right")).toBe(true);
    expect(documentsForDrawer(snapshot, "right")[0]?.id).toBe("f-62");
  });

  it("keeps a large durable history without exceeding browser persistence bounds", () => {
    let snapshot = createEmptyArchive();
    for (let index = 0; index < ARCHIVE_MAX_DOCUMENTS + 3; index += 1) {
      snapshot = archiveDocument(
        snapshot,
        createFreeformDocument(
          `note ${index}`,
          `2026-07-29T10:${String(index).padStart(4, "0")}:00Z`,
          `bounded-${index}`,
        ),
      );
    }
    expect(snapshot.documents).toHaveLength(ARCHIVE_MAX_DOCUMENTS);
    expect(snapshot.documents[0]?.id).toBe(`bounded-${ARCHIVE_MAX_DOCUMENTS + 2}`);
  });

  it("bounds individual paper text and rejects oversized serialized input", () => {
    const paper = createFreeformDocument("x".repeat(ARCHIVE_MAX_TEXT_LENGTH + 20));
    expect(paper.text).toHaveLength(ARCHIVE_MAX_TEXT_LENGTH);
    expect(parseArchiveSnapshot("x".repeat(ARCHIVE_MAX_SERIALIZED_LENGTH + 1)))
      .toEqual(createEmptyArchive());
  });

  it("migrates old archives and removes retired personal command papers", () => {
    const oldSnapshot = {
      version: 1,
      documents: [
        {
          id: "about-new",
          keyword: "about",
          title: "ABOUT / MOCK PROFILE",
          text: "new",
          drawer: "right",
          createdAt: "2026-07-29T10:02:00Z",
          mock: true,
        },
        {
          id: "about-first",
          keyword: "about",
          title: "ABOUT / MOCK PROFILE",
          text: "first",
          drawer: "left",
          createdAt: "2026-07-29T10:00:00Z",
          mock: true,
        },
      ],
      discovered: ["about"],
    };
    const migrated = parseArchiveSnapshot(JSON.stringify(oldSnapshot));

    expect(migrated.version).toBe(2);
    expect(migrated.documents).toEqual([]);
    expect(migrated.discovered).toEqual([]);
  });

  it("recovers safely from missing or malformed local data", () => {
    expect(parseArchiveSnapshot(null)).toEqual(createEmptyArchive());
    expect(parseArchiveSnapshot("{broken")).toEqual(createEmptyArchive());
    expect(parseArchiveSnapshot(JSON.stringify({version: 3}))).toEqual(createEmptyArchive());
  });
});
