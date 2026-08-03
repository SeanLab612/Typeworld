export function formatDiscoveredWords(discoveredCount: number): string {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(discoveredCount) ? discoveredCount : 0));
  return `${safeCount} ${safeCount === 1 ? "WORD" : "WORDS"} DISCOVERED`;
}

export function formatKeywordArchiveSummary(
  archivedCount: number,
  visuallyFull: boolean,
): string {
  const safeCount = Math.max(0, Math.floor(Number.isFinite(archivedCount) ? archivedCount : 0));
  return visuallyFull
    ? `视觉已满 · ${safeCount} 张首印`
    : `${safeCount} 张首印`;
}
