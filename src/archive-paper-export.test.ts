import {describe, expect, it} from "vitest";
import {
  ARCHIVE_PRINT_PAGE_CSS,
  archivePaperFilename,
} from "./archive-paper-export";

describe("archive paper export", () => {
  it("creates a portable PNG filename", () => {
    expect(archivePaperFilename("GREEN / OVERGROWTH")).toBe("GREEN-OVERGROWTH.png");
    expect(archivePaperFilename("  ")).toBe("typeworld-archive.png");
  });

  it("locks every archive sheet to one borderless A4 page", () => {
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain("size: A4 portrait");
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain("margin: 0");
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain("width: 210mm");
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain("height: 297mm");
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain("overflow: hidden");
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain("page-break-after: always");
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain(".archive-print-page:last-child");
    expect(ARCHIVE_PRINT_PAGE_CSS).toContain("page-break-inside: avoid");
  });
});
