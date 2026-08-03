export const AVAILABLE_LIBRARY_SHELF_INDICES = [1, 5, 9, 13, 17, 21, 25] as const;

export function selectLibraryShelfIndices(
  requestedCount: number,
): ReadonlyArray<number> {
  const count = Math.min(
    AVAILABLE_LIBRARY_SHELF_INDICES.length,
    Math.max(0, Math.floor(requestedCount)),
  );
  if (count === 0) return [];
  if (count === 1) {
    return [AVAILABLE_LIBRARY_SHELF_INDICES[Math.floor(AVAILABLE_LIBRARY_SHELF_INDICES.length / 2)]!];
  }
  return Array.from({length: count}, (_, index) => {
    const sourceIndex = Math.round(
      index * (AVAILABLE_LIBRARY_SHELF_INDICES.length - 1) / (count - 1),
    );
    return AVAILABLE_LIBRARY_SHELF_INDICES[sourceIndex]!;
  });
}
