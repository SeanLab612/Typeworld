import {
  ARCHIVE_STORAGE_KEY,
  LEGACY_ARCHIVE_STORAGE_KEY,
  parseArchiveSnapshot,
  type ArchiveDocument,
  type ArchiveSnapshot,
} from "./phase7-content";

export interface ArchiveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createFullCapacityQaArchive(): ArchiveSnapshot {
  const leftDocuments: ArchiveDocument[] = Array.from({length: 50}, (_, index) => {
    const number = index + 1;
    return {
      id: `qa-command-${number}`,
      kind: "command",
      keyword: `qa-keyword-${String(number).padStart(2, "0")}`,
      title: `QA KEYWORD PAPER ${String(number).padStart(2, "0")}`,
      text: `QA KEYWORD PAPER ${number}\n\nFull-capacity visual validation.`,
      drawer: "left",
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, number)).toISOString(),
      mock: true,
    };
  });
  const rightDocuments: ArchiveDocument[] = Array.from({length: 60}, (_, index) => {
    const number = index + 1;
    const text = number === 60
      ? Array.from(
          {length: 30},
          (_, lineIndex) => `Line ${String(lineIndex + 1).padStart(2, "0")} records a longer Typeworld room imprint for pagination review.`,
        ).join("\n")
      : `QA FREEFORM PAPER ${number}\n\nFull-capacity visual validation.`;
    return {
      id: `qa-freeform-${number}`,
      kind: "freeform",
      keyword: null,
      title: `QA FREEFORM PAPER ${String(number).padStart(2, "0")}`,
      text,
      drawer: "right",
      createdAt: new Date(Date.UTC(2026, 0, 2, 0, number)).toISOString(),
      mock: true,
    };
  });
  return {
    version: 2,
    documents: [...rightDocuments.reverse(), ...leftDocuments.reverse()],
    discovered: leftDocuments.map((documentRecord) => documentRecord.keyword as string),
  };
}

export function loadArchiveSnapshot(
  storage: ArchiveStorage,
  fullCapacityQaMode: boolean,
): ArchiveSnapshot {
  if (fullCapacityQaMode) return createFullCapacityQaArchive();
  try {
    return parseArchiveSnapshot(
      storage.getItem(ARCHIVE_STORAGE_KEY)
      ?? storage.getItem(LEGACY_ARCHIVE_STORAGE_KEY),
    );
  } catch {
    return parseArchiveSnapshot(null);
  }
}

export function persistArchiveSnapshot(
  storage: ArchiveStorage,
  snapshot: ArchiveSnapshot,
  fullCapacityQaMode: boolean,
): boolean {
  if (fullCapacityQaMode) return true;
  try {
    storage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
