import {describe, expect, it} from "vitest";
import {
  createFullCapacityQaArchive,
  loadArchiveSnapshot,
  persistArchiveSnapshot,
  type ArchiveStorage,
} from "../src/archive-runtime";
import {
  ARCHIVE_STORAGE_KEY,
  createEmptyArchive,
  LEGACY_ARCHIVE_STORAGE_KEY,
} from "../src/phase7-content";

class MemoryStorage implements ArchiveStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("archive runtime persistence", () => {
  it("loads the legacy key and writes only the current Typeworld key", () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_ARCHIVE_STORAGE_KEY, JSON.stringify(createEmptyArchive()));
    expect(loadArchiveSnapshot(storage, false)).toEqual(createEmptyArchive());
    expect(persistArchiveSnapshot(storage, createEmptyArchive(), false)).toBe(true);
    expect(storage.values.has(ARCHIVE_STORAGE_KEY)).toBe(true);
  });

  it("keeps the QA archive isolated from device storage", () => {
    const storage = new MemoryStorage();
    const qaArchive = createFullCapacityQaArchive();
    expect(qaArchive.documents).toHaveLength(110);
    expect(loadArchiveSnapshot(storage, true)).toEqual(qaArchive);
    expect(persistArchiveSnapshot(storage, qaArchive, true)).toBe(true);
    expect(storage.values.size).toBe(0);
  });

  it("reports storage failures without throwing into the rendering loop", () => {
    const storage: ArchiveStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    expect(persistArchiveSnapshot(storage, createEmptyArchive(), false)).toBe(false);
  });
});
