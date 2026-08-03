export const LIBRARY_VISITED_STORAGE_KEY = "typeworld.library.visited";
export const LIBRARY_VISITED_VERSION = "phase-13-v1";

export interface LibraryVisitStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function hasVisitedLibrary(storage: LibraryVisitStorage): boolean {
  try {
    return storage.getItem(LIBRARY_VISITED_STORAGE_KEY) === LIBRARY_VISITED_VERSION;
  } catch {
    return false;
  }
}

export function markLibraryVisited(storage: LibraryVisitStorage): boolean {
  try {
    storage.setItem(LIBRARY_VISITED_STORAGE_KEY, LIBRARY_VISITED_VERSION);
    return true;
  } catch {
    return false;
  }
}
