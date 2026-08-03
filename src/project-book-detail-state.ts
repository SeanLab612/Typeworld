export type ProjectBookDetailMode = "closed" | "opening" | "open" | "closing";

export const PROJECT_BOOK_DETAIL_LEAF_COUNT = 3;

export function clampProjectBookPageIndex(
  index: number,
  leafCount = PROJECT_BOOK_DETAIL_LEAF_COUNT,
): number {
  return Math.min(leafCount, Math.max(0, Math.round(index)));
}

export function getProjectBookPageLabel(
  index: number,
  leafCount = PROJECT_BOOK_DETAIL_LEAF_COUNT,
): string {
  const normalized = clampProjectBookPageIndex(index, leafCount);
  return `${String(normalized + 1).padStart(2, "0")} / ${String(leafCount + 1).padStart(2, "0")}`;
}

export interface ProjectBookDetailQueryState {
  readonly open: boolean;
  readonly pageIndex: number;
}

export function parseProjectBookDetailQuery(search: string): ProjectBookDetailQueryState {
  const params = new URLSearchParams(search);
  const requestedPage = Number.parseInt(params.get("page") ?? "0", 10);
  return {
    open: params.get("open") === "1",
    pageIndex: clampProjectBookPageIndex(Number.isFinite(requestedPage) ? requestedPage : 0),
  };
}
