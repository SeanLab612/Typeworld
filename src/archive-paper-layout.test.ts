import {describe, expect, it} from "vitest";

import {
  archiveDisplayTitle,
  archiveDocumentPages,
  archiveDocumentSerial,
  archiveListTitle,
  archivePageLabel,
  archiveTextExcerpt,
  FREEFORM_ARCHIVE_SIGNATURE,
  wrapArchiveText,
} from "./archive-paper-layout";
import type {ArchiveDocument} from "./phase7-content";

const freeform: ArchiveDocument = {
  id: "freeform-example",
  kind: "freeform",
  keyword: null,
  title: "FREEFORM / repeated body",
  text: "repeated body with several words",
  drawer: "right",
  createdAt: "2026-08-02T08:09:10.000Z",
  mock: false,
};

describe("archive paper layout", () => {
  it("replaces legacy freeform titles with a stable signature and serial", () => {
    expect(archiveDisplayTitle(freeform)).toBe(FREEFORM_ARCHIVE_SIGNATURE);
    expect(archiveListTitle(freeform)).toBe(archiveDocumentSerial(freeform));
    expect(archiveDocumentSerial(freeform)).toMatch(/^TW-260802-\d{4}$/u);
  });

  it("wraps words, preserves intentional blank lines, and splits long words", () => {
    expect(wrapArchiveText("one two three\n\nabcdefghij", 8)).toEqual([
      "one two",
      "three",
      "",
      "abcdefgh",
      "ij",
    ]);
  });

  it("paginates the body without duplicating the title", () => {
    const record = {...freeform, text: Array.from({length: 15}, (_, index) => `line${index}`).join("\n")};
    const pages = archiveDocumentPages(record, 6);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual(["line0", "line1", "line2", "line3", "line4", "line5"]);
    expect(pages[2]).toEqual(["line12", "line13", "line14"]);
    expect(archivePageLabel(1, pages.length)).toBe("02 / 03");
  });

  it("creates concise drawer excerpts", () => {
    expect(archiveTextExcerpt("  hello\nworld  ")).toBe("hello world");
    expect(archiveTextExcerpt("abcdefghijklmnopqrstuvwxyz", 10)).toBe("abcdefghi…");
  });
});
