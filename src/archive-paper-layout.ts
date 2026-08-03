import type {ArchiveDocument} from "./phase7-content";

export const FREEFORM_ARCHIVE_SIGNATURE = "A ROOM REMEMBERS WHAT YOU TYPE.";
export const ARCHIVE_PAPER_COLUMNS = 42;
export const ARCHIVE_PAPER_LINES_PER_PAGE = 12;

function hashArchiveId(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function archiveDocumentSerial(documentRecord: ArchiveDocument): string {
  const date = new Date(documentRecord.createdAt);
  const datePart = Number.isNaN(date.getTime())
    ? "000000"
    : `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  const sequence = String(hashArchiveId(documentRecord.id) % 10_000).padStart(4, "0");
  return `TW-${datePart}-${sequence}`;
}

export function archiveDisplayTitle(documentRecord: ArchiveDocument): string {
  return documentRecord.kind === "freeform"
    ? FREEFORM_ARCHIVE_SIGNATURE
    : documentRecord.title;
}

export function archiveListTitle(documentRecord: ArchiveDocument): string {
  return documentRecord.kind === "freeform"
    ? archiveDocumentSerial(documentRecord)
    : documentRecord.title;
}

export function archiveTextExcerpt(text: string, maximumLength = 38): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (!normalized) return "空白纸张";
  return normalized.length <= maximumLength
    ? normalized
    : `${normalized.slice(0, Math.max(1, maximumLength - 1)).trimEnd()}…`;
}

function wrapLongWord(word: string, columns: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < word.length; index += columns) {
    chunks.push(word.slice(index, index + columns));
  }
  return chunks;
}

export function wrapArchiveText(text: string, columns = ARCHIVE_PAPER_COLUMNS): string[] {
  const safeColumns = Math.max(8, Math.floor(columns));
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/gu, "\n").split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const sourceWord of paragraph.trim().split(/\s+/gu)) {
      const words = sourceWord.length > safeColumns
        ? wrapLongWord(sourceWord, safeColumns)
        : [sourceWord];
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= safeColumns) {
          current = next;
          continue;
        }
        if (current) lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  while (lines.length > 1 && lines.at(-1) === "") lines.pop();
  return lines.length > 0 ? lines : [""];
}

export function archiveDocumentPages(
  documentRecord: ArchiveDocument,
  linesPerPage = ARCHIVE_PAPER_LINES_PER_PAGE,
): string[][] {
  const safeLinesPerPage = Math.max(1, Math.floor(linesPerPage));
  const lines = wrapArchiveText(documentRecord.text);
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += safeLinesPerPage) {
    pages.push(lines.slice(index, index + safeLinesPerPage));
  }
  return pages.length > 0 ? pages : [[""]];
}

export function archivePageLabel(pageIndex: number, pageCount: number): string {
  const safeCount = Math.max(1, Math.floor(pageCount));
  const safeIndex = Math.min(safeCount - 1, Math.max(0, Math.floor(pageIndex)));
  return `${String(safeIndex + 1).padStart(2, "0")} / ${String(safeCount).padStart(2, "0")}`;
}
